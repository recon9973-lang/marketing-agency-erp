// 목표 경로: src/server/actions/content-plans.ts
//
// 콘텐츠 기획 — 생성/AI초안/상태전이/삭제. AI 초안은 생성 즉시 의료법 규칙엔진으로 검수.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertCanAccessClient } from "@/domain/access-control";
import { db } from "@/server/db";
import { generateContentPlan, isAiConfigured } from "@/server/ai/claude";
import { checkMedicalLaw } from "@/server/compliance/medical-law";
import { getDefaultOrgId } from "@/server/org";
import { renderContentPlanForPublish } from "@/server/marketing/render-plan";
import { wordpressPublish } from "@/server/marketing/providers/wordpress";
import {
  getAdminScopes,
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";

const STATUSES = ["PLANNED", "DRAFTED", "REVIEWED", "APPROVED", "PUBLISHED"] as const;

async function assertClientAccess(clientId: string) {
  const user = await requireUser();
  const client = await db.client.findUnique({ where: { id: clientId }, select: { assignedMarketerId: true } });
  if (!client) throw new Error("NOT_FOUND");
  const scopes = await getAdminScopes(user);
  assertCanAccessClient(user, clientId, scopes, client.assignedMarketerId);
  return user;
}

const createSchema = z.object({
  clientId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  topic: z.string().trim().min(1).max(200),
  keyword: z.string().trim().max(120).optional().nullable(),
  generate: z.boolean().optional()
});

export async function createContentPlan(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const p = createSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    const user = await assertClientAccess(d.clientId);

    let angle: string | null = null;
    let faq: string[] = [];
    let qa: { q: string; a: string }[] = [];
    let complianceRisk: unknown = null;
    let status = "PLANNED";

    if (d.generate) {
      if (!isAiConfigured()) throw new Error("AI_NOT_CONFIGURED");
      const profile = await db.hospitalProfile.findUnique({
        where: { clientId: d.clientId },
        select: { departments: true, strengths: true, preferredTone: true, prohibitedClaims: true }
      });
      const context = [profile?.departments, profile?.strengths, profile?.preferredTone].filter(Boolean).join(" / ") || null;
      const draft = await generateContentPlan({ topic: d.topic, keyword: d.keyword, hospitalContext: context, prohibited: profile?.prohibitedClaims });
      angle = draft.angle;
      faq = draft.faq;
      qa = draft.qa;
      status = "DRAFTED";
      // 생성 즉시 의료법 검수.
      const combined = [draft.angle, ...draft.faq, ...draft.qa.flatMap((x) => [x.q, x.a])].join("\n");
      const check = checkMedicalLaw(combined, profile?.prohibitedClaims);
      complianceRisk = { high: check.highCount, medium: check.mediumCount, flags: check.flags };
    }

    const meta = await requestMeta();
    const orgId = await getDefaultOrgId();
    const created = await db.$transaction(async (tx) => {
      const plan = await tx.contentPlan.create({
        data: {
          clientId: d.clientId,
          month: d.month,
          topic: d.topic,
          keyword: d.keyword || null,
          angle,
          faq,
          qa,
          complianceRisk: complianceRisk ?? undefined,
          status,
          orgId
        }
      });
      await recordAudit(tx, { actorId: user.id, action: "contentPlan.create", targetType: "ContentPlan", targetId: plan.id, afterState: { topic: d.topic, generated: Boolean(d.generate) }, ...meta });
      return plan;
    });

    revalidatePath(`/clients/${d.clientId}`);
    return { id: created.id };
  });
}

const reviseSchema = z.object({
  id: z.string().min(1),
  angle: z.string().trim().max(4000).optional().nullable(),
  faq: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  qa: z.array(z.object({ q: z.string().trim().min(1).max(500), a: z.string().trim().min(1).max(2000) })).max(20).optional()
});

/**
 * 콘텐츠(방향/FAQ/QA) 수정 + 의료법 재검수 — 게시 잠금 해소 경로(§15 수정중→재검수).
 * 위험 플래그는 angle/faq/qa 결합 텍스트에서 산출되므로 같은 필드를 수정해 재검수한다.
 * high 위험이 남으면 잠금 유지, 해소되면 승인/게시가 가능해진다.
 */
export async function reviseContentPlan(input: unknown): Promise<ActionResult<{ high: number; medium: number }>> {
  return runAction(async () => {
    const p = reviseSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const plan = await db.contentPlan.findUnique({
      where: { id: p.data.id },
      select: { clientId: true, status: true, angle: true, faq: true, qa: true }
    });
    if (!plan) throw new Error("NOT_FOUND");
    const user = await assertClientAccess(plan.clientId);

    // 미전달 필드는 기존 값 유지 — 부분 수정 허용
    const angle = p.data.angle !== undefined ? p.data.angle : (plan.angle as string | null);
    const faq = p.data.faq ?? ((Array.isArray(plan.faq) ? plan.faq : []) as string[]);
    const qa = p.data.qa ?? ((Array.isArray(plan.qa) ? plan.qa : []) as { q: string; a: string }[]);

    const profile = await db.hospitalProfile.findUnique({
      where: { clientId: plan.clientId },
      select: { prohibitedClaims: true }
    });
    const combined = [angle, ...faq, ...qa.flatMap((x) => [x.q, x.a])].filter(Boolean).join("\n");
    const check = checkMedicalLaw(combined, profile?.prohibitedClaims);
    const complianceRisk = { high: check.highCount, medium: check.mediumCount, flags: check.flags };

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.contentPlan.update({
        where: { id: p.data.id },
        data: {
          angle,
          faq,
          qa,
          complianceRisk,
          // 수정하면 재검수 단계로 되돌림(승인 상태였다면 내부검수부터 다시)
          ...(plan.status === "APPROVED" ? { status: "REVIEWED" } : {}),
          ...(plan.status === "PLANNED" ? { status: "DRAFTED" } : {}),
          // 내용이 바뀌었으므로 병원 재확인 필요
          clientConfirmedAt: null
        }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "contentPlan.revise",
        targetType: "ContentPlan",
        targetId: p.data.id,
        afterState: { high: check.highCount, medium: check.mediumCount },
        ...meta
      });
    });
    revalidatePath(`/clients/${plan.clientId}`);
    return { high: check.highCount, medium: check.mediumCount };
  });
}

export async function updateContentPlanStatus(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const p = z
      .object({
        id: z.string().min(1),
        status: z.enum(STATUSES),
        publishedUrl: z.string().trim().max(500).optional().nullable()
      })
      .safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const plan = await db.contentPlan.findUnique({
      where: { id: p.data.id },
      select: { clientId: true, complianceRisk: true, clientConfirmedAt: true }
    });
    if (!plan) throw new Error("NOT_FOUND");
    const user = await assertClientAccess(plan.clientId);

    // 게시 잠금(기획서 §7 콘텐츠·§15): high 위험표현 미해소 시 승인/게시 불가,
    // 병원(거래처) 확인 전에는 게시 불가. 위험 해소는 원고 수정→재검수로만 가능하다.
    if (p.data.status === "APPROVED" || p.data.status === "PUBLISHED") {
      const risk = plan.complianceRisk as { high?: number } | null;
      if ((risk?.high ?? 0) > 0) throw new Error("COMPLIANCE_BLOCKED");
    }
    if (p.data.status === "PUBLISHED" && !plan.clientConfirmedAt) {
      throw new Error("CLIENT_APPROVAL_REQUIRED");
    }

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.contentPlan.update({
        where: { id: p.data.id },
        data: {
          status: p.data.status,
          // 게시 증빙 URL(§5-9) — PUBLISHED 전이 시 기록
          ...(p.data.status === "PUBLISHED" && p.data.publishedUrl ? { publishedUrl: p.data.publishedUrl } : {})
        }
      });
      // GEO 답변 페이지였다면 질문의 대응 페이지 URL 자동 채움(질문↔페이지 루프 완결)
      if (p.data.status === "PUBLISHED" && p.data.publishedUrl) {
        await tx.geoQuestion.updateMany({
          where: { answerPlanId: p.data.id },
          data: { targetPageUrl: p.data.publishedUrl }
        });
      }
      await recordAudit(tx, { actorId: user.id, action: "contentPlan.status", targetType: "ContentPlan", targetId: p.data.id, afterState: { status: p.data.status, publishedUrl: p.data.publishedUrl ?? undefined }, ...meta });
    });
    revalidatePath(`/clients/${plan.clientId}`);
  });
}

/**
 * 실행 자동화 #3 — 승인·병원 확인된 콘텐츠를 워드프레스로 원클릭 게시.
 * 게이트는 수동 게시(updateContentPlanStatus PUBLISHED)와 동일: high 위험 0 + 병원 확인(clientConfirmedAt).
 * 성공 시 status=PUBLISHED + publishedUrl(발행 URL) 기록 + GEO 질문 대응 페이지 자동 연결.
 * 워드프레스 미설정/실패는 사용자 친화 코드로 반환해 "URL 직접 입력" 경로로 우회할 수 있게 한다.
 */
export async function publishContentPlanToWordPress(input: unknown): Promise<ActionResult<{ url: string; scheduled: boolean }>> {
  return runAction(async () => {
    const p = z
      .object({ id: z.string().min(1), scheduledAt: z.string().datetime().optional().nullable() })
      .safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const plan = await db.contentPlan.findUnique({
      where: { id: p.data.id },
      select: {
        clientId: true,
        topic: true,
        angle: true,
        faq: true,
        qa: true,
        draft: true,
        complianceRisk: true,
        clientConfirmedAt: true
      }
    });
    if (!plan) throw new Error("NOT_FOUND");
    const user = await assertClientAccess(plan.clientId);

    // 게시 잠금(수동 게시와 동일 게이트)
    const risk = plan.complianceRisk as { high?: number } | null;
    if ((risk?.high ?? 0) > 0) throw new Error("COMPLIANCE_BLOCKED");
    if (!plan.clientConfirmedAt) throw new Error("CLIENT_APPROVAL_REQUIRED");

    const { title, html } = renderContentPlanForPublish({
      topic: plan.topic,
      angle: plan.angle as string | null,
      faq: (Array.isArray(plan.faq) ? plan.faq : []) as string[],
      qa: (Array.isArray(plan.qa) ? plan.qa : []) as { q: string; a: string }[],
      draft: plan.draft as string | null
    });
    if (!html.trim()) throw new Error("NOTHING_TO_PUBLISH");

    const scheduledAt = p.data.scheduledAt ?? undefined;
    const result = await wordpressPublish.publish({
      channel: "WORDPRESS",
      title,
      bodyHtmlOrMarkdown: html,
      scheduledAt
    });
    if (!result.ok) {
      if (result.error.code === "CONFIG_MISSING") throw new Error("WORDPRESS_NOT_CONFIGURED");
      throw new Error("PUBLISH_FAILED");
    }

    const publishedUrl = result.data.externalUrl ?? null;
    const scheduled = result.data.status === "SCHEDULED";

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.contentPlan.update({
        where: { id: p.data.id },
        // 예약이면 승인 상태 유지(발행 대기), 즉시 게시면 PUBLISHED
        data: {
          ...(scheduled ? {} : { status: "PUBLISHED" }),
          ...(publishedUrl ? { publishedUrl } : {})
        }
      });
      // GEO 답변 페이지였다면 질문의 대응 페이지 URL 자동 채움(수동 게시 훅과 동일)
      if (!scheduled && publishedUrl) {
        await tx.geoQuestion.updateMany({ where: { answerPlanId: p.data.id }, data: { targetPageUrl: publishedUrl } });
      }
      await recordAudit(tx, {
        actorId: user.id,
        action: "contentPlan.publishWordpress",
        targetType: "ContentPlan",
        targetId: p.data.id,
        afterState: { status: scheduled ? "SCHEDULED" : "PUBLISHED", publishedUrl: publishedUrl ?? undefined },
        ...meta
      });
    });

    revalidatePath(`/clients/${plan.clientId}`);
    return { url: publishedUrl ?? "", scheduled };
  });
}

export async function deleteContentPlan(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const plan = await db.contentPlan.findUnique({ where: { id: p.data.id }, select: { clientId: true } });
    if (!plan) throw new Error("NOT_FOUND");
    const user = await assertClientAccess(plan.clientId);

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.contentPlan.delete({ where: { id: p.data.id } });
      await recordAudit(tx, { actorId: user.id, action: "contentPlan.delete", targetType: "ContentPlan", targetId: p.data.id, ...meta });
    });
    revalidatePath(`/clients/${plan.clientId}`);
  });
}
