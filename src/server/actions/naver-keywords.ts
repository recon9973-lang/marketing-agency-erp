// src/server/actions/naver-keywords.ts
//
// 네이버 6단계 워크플로우 ②③④ — 씨드 키워드에서 연관 키워드를 확장(keywordstool relKeyword)하고
// 검색량 A/B/C 등급을 매겨 기존 Keyword 모델에 저장한다(병렬 저장소 없이 유기적 확장).
// keywordstool 1회 호출이 relKeyword+검색량을 함께 주므로 확장은 N+1 없이 저렴하다.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertCanAccessClient } from "@/domain/access-control";
import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import { fetchKeywordVolumes, fetchRelatedKeywords, naverSearchConfigured } from "@/server/integrations/naver-search";
import { gradeByVolume, type KeywordGrade } from "@/domain/marketing/keyword-grade";
import {
  getAdminScopes,
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";

const schema = z.object({
  clientId: z.string().min(1),
  seeds: z.array(z.string().trim().min(1).max(60)).min(1).max(5),
  channel: z.string().trim().max(20).default("blog")
});

// 등급 → 우선순위(1 높음 ~ 5 낮음).
const GRADE_PRIORITY: Record<KeywordGrade, number> = { A: 1, B: 3, C: 5 };

export type NaverExpandResult = { seeds: number; related: number; saved: number; estimated: boolean; distribution: Record<KeywordGrade, number> };

export async function expandNaverKeywords(input: unknown): Promise<ActionResult<NaverExpandResult>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = schema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const { clientId, seeds, channel } = p.data;

    const client = await db.client.findUnique({ where: { id: clientId }, select: { assignedMarketerId: true } });
    if (!client) throw new Error("NOT_FOUND");
    const scopes = await getAdminScopes(user);
    assertCanAccessClient(user, clientId, scopes, client.assignedMarketerId);

    // 씨드 검색량(≤5) + 연관 확장(relKeyword 전량, 검색량 포함).
    const [seedVols, related] = await Promise.all([fetchKeywordVolumes(seeds), fetchRelatedKeywords(seeds)]);
    const estimated = !naverSearchConfigured();

    type Row = { keyword: string; total: number | null; competition: string | null; stage: "seed" | "related" };
    const rows: Row[] = [
      ...seedVols.map((v) => ({ keyword: v.keyword, total: v.total, competition: v.competition, stage: "seed" as const })),
      ...related.map((v) => ({ keyword: v.keyword, total: v.total, competition: v.competition, stage: "related" as const }))
    ];

    // 기존 키워드 dedup(메모리) — N+1 회피.
    const existing = new Set(
      (await db.keyword.findMany({ where: { clientId }, select: { keyword: true } })).map((k) => k.keyword.replace(/\s+/g, ""))
    );
    const distribution: Record<KeywordGrade, number> = { A: 0, B: 0, C: 0 };
    const orgId = await getDefaultOrgId();
    const toCreate: Array<Record<string, unknown>> = [];
    for (const r of rows) {
      const norm = r.keyword.replace(/\s+/g, "");
      if (!norm || existing.has(norm)) continue;
      existing.add(norm);
      const grade = gradeByVolume(r.total);
      distribution[grade]++;
      toCreate.push({
        clientId,
        keyword: r.keyword,
        searchVolume: r.total ?? null,
        grade,
        stage: r.stage,
        competition: r.competition ?? null,
        channel,
        priority: GRADE_PRIORITY[grade],
        orgId
      });
    }

    if (toCreate.length) {
      await db.$transaction(async (tx) => {
        await tx.keyword.createMany({ data: toCreate as never, skipDuplicates: true });
        await recordAudit(tx, {
          actorId: user.id,
          action: "naver.expandKeywords",
          targetType: "Client",
          targetId: clientId,
          afterState: { seeds: seeds.length, saved: toCreate.length, estimated, distribution },
          ...(await requestMeta())
        });
      });
    }

    revalidatePath(`/clients/${clientId}`);
    return { seeds: seeds.length, related: related.length, saved: toCreate.length, estimated, distribution };
  });
}
