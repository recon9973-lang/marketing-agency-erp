// 목표 경로: src/server/actions/consulting.ts
//
// 영업 컨설팅 — 병원 정보로 키워드·경쟁·상권 분석(Claude) 생성 후 저장.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertCanAccessClient } from "@/domain/access-control";
import { db } from "@/server/db";
import { generateConsulting, isAiConfigured } from "@/server/ai/claude";
import { fetchKeywordVolumes } from "@/server/integrations/naver-search";
import { getDefaultOrgId } from "@/server/org";
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
  hospitalName: z.string().trim().min(1).max(120),
  address: z.string().trim().max(200).optional().nullable(),
  departments: z.string().trim().max(200).optional().nullable(),
  competitors: z.string().trim().max(300).optional().nullable()
});

export async function runConsulting(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    if (!isAiConfigured()) throw new Error("AI_NOT_CONFIGURED");
    const p = schema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    const client = await db.client.findUnique({ where: { id: d.clientId }, select: { assignedMarketerId: true } });
    if (!client) throw new Error("NOT_FOUND");
    const scopes = await getAdminScopes(user);
    assertCanAccessClient(user, d.clientId, scopes, client.assignedMarketerId);

    const result = await generateConsulting({
      hospitalName: d.hospitalName,
      address: d.address,
      departments: d.departments,
      competitors: d.competitors
    });

    // 네이버 검색광고 API로 실제 검색량 보강(미연동 시 데모 추정치). 최대 100개.
    const volMap = new Map<string, { total: number | null; estimated: boolean }>();
    try {
      const vols = await fetchKeywordVolumes(result.coreKeywords.map((k) => k.keyword).slice(0, 100));
      for (const v of vols) volMap.set(v.keyword, { total: v.total, estimated: v.estimated });
    } catch {
      /* 검색량 조회 실패는 무시하고 진행 */
    }
    // 리포트에 저장할 키워드에 검색량 부착.
    const enrichedKeywords = result.coreKeywords.map((k) => ({
      ...k,
      searchVolume: volMap.get(k.keyword)?.total ?? null,
      estimated: volMap.get(k.keyword)?.estimated ?? true
    }));

    const meta = await requestMeta();
    const orgId = await getDefaultOrgId();
    const saved = await db.$transaction(async (tx) => {
      const report = await tx.consultingReport.create({
        data: {
          clientId: d.clientId,
          authorId: user.id,
          hospitalName: d.hospitalName,
          address: d.address || null,
          departments: d.departments || null,
          keywords: enrichedKeywords,
          competitors: result.competitorAnalysis,
          marketAnalysis: result.marketAnalysis,
          summary: result.summary,
          status: "DRAFT",
          orgId
        }
      });
      // 산출 키워드를 Keyword 테이블에도 저장(중복 방지: 기존 동일 키워드 스킵).
      const existing = new Set(
        (await tx.keyword.findMany({ where: { clientId: d.clientId }, select: { keyword: true } })).map((k) => k.keyword)
      );
      for (const k of enrichedKeywords) {
        if (existing.has(k.keyword)) continue;
        existing.add(k.keyword);
        await tx.keyword.create({
          data: { clientId: d.clientId, keyword: k.keyword, intent: k.intent || null, priority: k.priority, channel: k.channel, searchVolume: k.searchVolume, orgId }
        });
      }
      await recordAudit(tx, {
        actorId: user.id,
        action: "consulting.run",
        targetType: "ConsultingReport",
        targetId: report.id,
        afterState: { hospitalName: d.hospitalName, keywords: result.coreKeywords.length },
        ...meta
      });
      return report;
    });

    revalidatePath(`/clients/${d.clientId}`);
    return { id: saved.id };
  });
}
