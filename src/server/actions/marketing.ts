// 목표 경로: src/server/actions/marketing.ts
//
// 마케팅 스튜디오(VME) server actions. 기존 _helpers 규약을 그대로 재사용한다.
// - runAction: 표준 에러 → ActionResult 변환
// - requireUser + assertCanAccessClient: 거래처 접근권한 게이트
// - recordAudit: 민감 작업 감사기록
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertCanAccessClient } from "@/domain/access-control";
import { db } from "@/server/db";
import {
  getAdminScopes,
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";
import type { CurrentUser } from "@/server/session";
import {
  collectKeywordResearch,
  collectPerformanceForReport,
  type KeywordResearchSnapshot
} from "@/server/marketing/research";
import { runBlogDraftPipeline, type DraftPipelineResult } from "@/server/marketing/content-pipeline";
import { assembleMonthlyReport, type RankSummary } from "@/server/marketing/report-assembly";

async function assertClient(user: CurrentUser, clientId: string, assignedMarketerId: string | null) {
  const scopes = await getAdminScopes(user);
  assertCanAccessClient(user, clientId, scopes, assignedMarketerId);
}

/** ① 키워드 리서치(트렌드+경쟁강도). 거래처 접근권한 확인. */
export async function researchKeyword(input: unknown): Promise<ActionResult<KeywordResearchSnapshot>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z
      .object({
        clientId: z.string().min(1),
        seedKeyword: z.string().trim().min(1).max(100),
        related: z.array(z.string().trim().min(1)).max(10).optional()
      })
      .safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const client = await db.client.findUnique({ where: { id: p.data.clientId }, select: { assignedMarketerId: true } });
    if (!client) throw new Error("NOT_FOUND");
    await assertClient(user, p.data.clientId, client.assignedMarketerId);
    return collectKeywordResearch({ seedKeyword: p.data.seedKeyword, related: p.data.related });
  });
}

/** ② SEO 블로그 초안 생성 + (의료 주제면) 의료광고법 검수 게이트. */
export async function generateBlogDraft(input: unknown): Promise<ActionResult<DraftPipelineResult>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z
      .object({
        clientId: z.string().min(1),
        keyword: z.string().trim().min(1).max(100),
        audience: z.string().trim().max(200).optional(),
        referenceUrls: z.array(z.string().url()).max(10).optional(),
        notes: z.string().max(2000).optional(),
        medical: z.boolean().optional()
      })
      .safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const client = await db.client.findUnique({ where: { id: p.data.clientId }, select: { assignedMarketerId: true } });
    if (!client) throw new Error("NOT_FOUND");
    await assertClient(user, p.data.clientId, client.assignedMarketerId);
    return runBlogDraftPipeline({ ...p.data, referenceUrls: p.data.referenceUrls ?? [] });
  });
}

/** ③ 보고서 성과수집(키워드 노출순위 → Report.metrics). */
export async function collectReportPerformance(input: unknown): Promise<ActionResult<{ collected: number }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z
      .object({
        reportId: z.string().min(1),
        keywords: z.array(z.string().trim().min(1)).min(1).max(50),
        target: z.string().trim().min(1),
        channel: z.enum(["blog", "web", "local"]).optional()
      })
      .safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const rep = await db.report.findUnique({
      where: { id: p.data.reportId },
      include: { client: { select: { assignedMarketerId: true } } }
    });
    if (!rep) throw new Error("NOT_FOUND");
    await assertClient(user, rep.clientId, rep.client.assignedMarketerId);

    const res = await collectPerformanceForReport({
      reportId: p.data.reportId,
      keywords: p.data.keywords,
      target: p.data.target,
      channel: p.data.channel
    });
    if (!res.ok) throw new Error(res.error === "CONFIG_MISSING" ? "CONFIG_MISSING" : "UNKNOWN");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await recordAudit(tx, {
        actorId: user.id,
        action: "marketing.collectPerformance",
        targetType: "Report",
        targetId: p.data.reportId,
        afterState: { collected: res.collected },
        ...meta
      });
    });
    revalidatePath("/reports");
    revalidatePath("/studio");
    return { collected: res.collected };
  });
}

/** ④ 월간 리포트 자동조립(순위 집계 + 요약 코멘트 → Report.metrics). */
export async function assembleReport(
  input: unknown
): Promise<ActionResult<RankSummary & { reportId: string; assembledAt: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ reportId: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const rep = await db.report.findUnique({
      where: { id: p.data.reportId },
      include: { client: { select: { assignedMarketerId: true } } }
    });
    if (!rep) throw new Error("NOT_FOUND");
    await assertClient(user, rep.clientId, rep.client.assignedMarketerId);

    const summary = await assembleMonthlyReport(p.data.reportId, { persist: true });
    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await recordAudit(tx, {
        actorId: user.id,
        action: "marketing.assembleReport",
        targetType: "Report",
        targetId: p.data.reportId,
        afterState: { rankedCount: summary.rankedCount },
        ...meta
      });
    });
    revalidatePath("/reports");
    revalidatePath("/studio");
    return summary;
  });
}
