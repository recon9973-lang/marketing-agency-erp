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

export async function updateContentPlanStatus(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const p = z.object({ id: z.string().min(1), status: z.enum(STATUSES) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const plan = await db.contentPlan.findUnique({ where: { id: p.data.id }, select: { clientId: true } });
    if (!plan) throw new Error("NOT_FOUND");
    const user = await assertClientAccess(plan.clientId);

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.contentPlan.update({ where: { id: p.data.id }, data: { status: p.data.status } });
      await recordAudit(tx, { actorId: user.id, action: "contentPlan.status", targetType: "ContentPlan", targetId: p.data.id, afterState: { status: p.data.status }, ...meta });
    });
    revalidatePath(`/clients/${plan.clientId}`);
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
