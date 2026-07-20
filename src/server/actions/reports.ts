// 목표 경로: src/server/actions/reports.ts
//
// 월간 보고서 — 작성/성과지표(JSON)/검토·전달 + 상태전이.
// 상태: DRAFT → REVIEW_NEEDED → APPROVED → DELIVERED.
// 권한: 작성/지표=담당 가능자, 검토·전달=관리자 이상.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role } from "@/domain/types";
import { assertCanAccessClient } from "@/domain/access-control";
import { db } from "@/server/db";
import { geoMonthlySummary } from "@/server/repositories/geo";
import {
  getAdminScopes,
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";
import { requestApproval } from "@/server/actions/approvals";
import type { CurrentUser } from "@/server/session";

async function assertClient(user: CurrentUser, clientId: string, assignedMarketerId: string | null) {
  const scopes = await getAdminScopes(user);
  assertCanAccessClient(user, clientId, scopes, assignedMarketerId);
}
function assertReviewer(role: Role) {
  if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN) throw new Error("FORBIDDEN");
}

const createSchema = z.object({
  clientId: z.string().min(1),
  reportingMonth: z.string().regex(/^\d{4}-\d{2}$/),
  title: z.string().trim().min(1),
  workItemId: z.string().optional().nullable()
});

export async function createReport(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = createSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    const client = await db.client.findUnique({ where: { id: d.clientId } });
    if (!client) throw new Error("NOT_FOUND");
    await assertClient(user, d.clientId, client.assignedMarketerId);

    const meta = await requestMeta();
    const saved = await db.$transaction(async (tx) => {
      const rep = await tx.report.create({
        data: {
          clientId: d.clientId,
          authorId: user.id,
          reportingMonth: d.reportingMonth,
          title: d.title,
          status: "DRAFT",
          workItemId: d.workItemId || null
        }
      });
      await recordAudit(tx, { actorId: user.id, action: "report.create", targetType: "Report", targetId: rep.id, afterState: rep, ...meta });
      return rep;
    });
    // 결재라인 연결 — 상신하면 담당자→관리자→최고관리자 순으로 결재된다(승인함에 노출).
    await requestApproval({ targetType: "MONTHLY_REPORT", targetId: saved.id, title: `월간보고 · ${d.title}`, clientId: d.clientId }).catch(() => undefined);
    revalidatePath("/reports");
    return { id: saved.id };
  });
}

const genSchema = z.object({
  clientId: z.string().min(1),
  reportingMonth: z.string().regex(/^\d{4}-\d{2}$/)
});

/**
 * 월간 보고서 자동 초안 — 계약 상품·완료 업무·순위·게시 콘텐츠를 집계해 지표를 채운다.
 * (clientId, reportingMonth) 기준 upsert. 이미 있으면 지표만 갱신(DRAFT로).
 */
export async function generateMonthlyReport(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = genSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const { clientId, reportingMonth } = p.data;

    const client = await db.client.findUnique({ where: { id: clientId }, select: { name: true, assignedMarketerId: true } });
    if (!client) throw new Error("NOT_FOUND");
    await assertClient(user, clientId, client.assignedMarketerId);

    const start = new Date(`${reportingMonth}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    // 집계
    const [contractProducts, completedWork, publishedContent, rankRows, geo] = await Promise.all([
      db.contractProduct.findMany({ where: { contract: { clientId } }, select: { product: { select: { name: true } } } }),
      db.workItem.count({ where: { clientId, status: "COMPLETED", updatedAt: { gte: start, lt: end } } }),
      db.contentPlan.count({ where: { clientId, status: "PUBLISHED", month: reportingMonth } }),
      db.placeRankRecord.findMany({ where: { clientId, recordedOn: { gte: start, lt: end } }, orderBy: { recordedOn: "desc" }, select: { keyword: true, rank: true } }),
      geoMonthlySummary(clientId, start, end)
    ]);

    const products = [...new Set(contractProducts.map((cp) => cp.product.name))];
    // 키워드별 최신 순위(내림차순 정렬이라 첫 등장이 최신).
    const rankMap = new Map<string, number>();
    for (const r of rankRows) if (!rankMap.has(r.keyword)) rankMap.set(r.keyword, r.rank);
    const keywordRanks = [...rankMap.entries()].map(([keyword, rank]) => ({ keyword, rank }));

    const monthLabel = `${start.getUTCFullYear()}년 ${start.getUTCMonth() + 1}월`;
    const summary =
      `${client.name} ${monthLabel} 운영 요약: 계약 상품 ${products.length}종 운영, ` +
      `완료 업무 ${completedWork}건, 게시 콘텐츠 ${publishedContent}건` +
      (keywordRanks.length ? `, 순위 추적 ${keywordRanks.length}개 키워드` : "") +
      (geo.checks > 0 ? `, AI답변 관측 ${geo.checks}회(질문 ${geo.monitoredQuestions}개 중 출현 ${geo.appearedQuestions}개).` : ".");

    const metrics = {
      summary,
      "계약 상품": products.join(", ") || "-",
      "완료 업무": `${completedWork}건`,
      "게시 콘텐츠": `${publishedContent}건`,
      keywordRanks,
      // GEO 모니터링(§13) — 노출 보장 지표가 아닌 관측 지표. 리포트에 고지 문구 필수.
      ...(geo.checks > 0
        ? {
            geo: {
              ...geo,
              disclaimer: "AI 답변 출현은 보장 지표가 아닌 모니터링 지표이며, 엔진 정책에 따라 수시로 변동될 수 있습니다."
            }
          }
        : {})
    };

    const meta = await requestMeta();
    const saved = await db.$transaction(async (tx) => {
      const rep = await tx.report.upsert({
        where: { clientId_reportingMonth: { clientId, reportingMonth: start } },
        create: { clientId, authorId: user.id, reportingMonth: start, title: `${client.name} ${monthLabel} 월간보고서`, status: "DRAFT", metrics },
        update: { metrics, status: "DRAFT" }
      });
      await recordAudit(tx, { actorId: user.id, action: "report.autoGenerate", targetType: "Report", targetId: rep.id, afterState: { completedWork, publishedContent, products: products.length }, ...meta });
      return rep;
    });

    revalidatePath("/reports");
    revalidatePath(`/clients/${clientId}`);
    return { id: saved.id };
  });
}

/** 성과 지표 저장 (JSON). 키워드 순위 자동수집분 + 수기분 병합. */
export async function updateReportMetrics(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1), metrics: z.record(z.any()), attachmentUrl: z.string().url().optional().nullable().or(z.literal("")) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const rep = await db.report.findUnique({ where: { id: p.data.id }, include: { client: { select: { assignedMarketerId: true } } } });
    if (!rep) throw new Error("NOT_FOUND");
    await assertClient(user, rep.clientId, rep.client.assignedMarketerId);

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.report.update({ where: { id: p.data.id }, data: { metrics: p.data.metrics as never, attachmentUrl: p.data.attachmentUrl || undefined } });
      await recordAudit(tx, { actorId: user.id, action: "report.metrics", targetType: "Report", targetId: p.data.id, afterState: { keys: Object.keys(p.data.metrics) }, ...meta });
    });
    revalidatePath("/reports");
  });
}

/** 상태전이: DRAFT→REVIEW_NEEDED(작성자), REVIEW_NEEDED→APPROVED, APPROVED→DELIVERED(검토자). */
const transitionMap: Record<string, { from: string; to: string; reviewer: boolean }> = {
  submit:  { from: "DRAFT", to: "REVIEW_NEEDED", reviewer: false },
  approve: { from: "REVIEW_NEEDED", to: "APPROVED", reviewer: true },
  deliver: { from: "APPROVED", to: "DELIVERED", reviewer: true }
};

export async function transitionReport(input: unknown): Promise<ActionResult<{ status: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1), action: z.enum(["submit", "approve", "deliver"]) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const rule = transitionMap[p.data.action];

    const rep = await db.report.findUnique({ where: { id: p.data.id }, include: { client: { select: { assignedMarketerId: true } } } });
    if (!rep) throw new Error("NOT_FOUND");
    if (rep.status !== rule.from) throw new Error("ILLEGAL_TRANSITION");
    if (rule.reviewer) assertReviewer(user.role);
    else await assertClient(user, rep.clientId, rep.client.assignedMarketerId);

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: p.data.id },
        data: {
          status: rule.to as never,
          reviewerId: rule.reviewer ? user.id : undefined,
          deliveredAt: rule.to === "DELIVERED" ? new Date() : undefined
        }
      });
      await recordAudit(tx, { actorId: user.id, action: `report.${p.data.action}`, targetType: "Report", targetId: p.data.id, beforeState: { status: rep.status }, afterState: { status: rule.to }, ...meta });
    });
    revalidatePath("/reports");
    return { status: rule.to };
  });
}
