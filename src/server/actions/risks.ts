// src/server/actions/risks.ts
//
// 리스크(RiskLog) 쓰기 server actions — 감지 등록 + 상태 전이(§12 Risk 흐름).
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertCanAccessClient } from "@/domain/access-control";
import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import {
  RISK_STATUSES,
  canTransitionRisk,
  isRiskStatus,
  severityScore,
  type RiskStatus,
  type RiskSeverity
} from "@/domain/sales/risk";
import {
  getAdminScopes,
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";

const createSchema = z.object({
  clientId: z.string().min(1).optional().nullable(),
  category: z.enum(["compliance", "sla", "credential", "approval", "performance", "other"]),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().max(2000).optional().nullable(),
  sourceType: z.string().trim().max(40).optional().nullable(),
  sourceId: z.string().trim().max(60).optional().nullable()
});

/** 리스크 감지 등록. source(sourceType+sourceId+category)가 있으면 동일 건 재등록을 upsert로 멱등 처리. */
export async function createRisk(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = createSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    if (d.clientId) {
      const c = await db.client.findUnique({ where: { id: d.clientId }, select: { assignedMarketerId: true } });
      if (!c) throw new Error("NOT_FOUND");
      const scopes = await getAdminScopes(user);
      assertCanAccessClient(user, d.clientId, scopes, c.assignedMarketerId);
    }

    const orgId = await getDefaultOrgId();
    const meta = await requestMeta();
    const score = severityScore(d.severity as RiskSeverity);

    const saved = await db.$transaction(async (tx) => {
      // 멱등: 동일 소스의 리스크가 이미 열려있으면 재활성/갱신, 아니면 신규.
      const existing =
        d.clientId && d.sourceType && d.sourceId
          ? await tx.riskLog.findFirst({
              where: { clientId: d.clientId, sourceType: d.sourceType, sourceId: d.sourceId, category: d.category },
              select: { id: true }
            })
          : null;

      const risk = existing
        ? await tx.riskLog.update({
            where: { id: existing.id },
            data: { severity: d.severity, title: d.title, detail: d.detail ?? null, score }
          })
        : await tx.riskLog.create({
            data: {
              clientId: d.clientId ?? null,
              category: d.category,
              severity: d.severity,
              title: d.title,
              detail: d.detail ?? null,
              sourceType: d.sourceType ?? null,
              sourceId: d.sourceId ?? null,
              score,
              ownerId: user.id,
              orgId
            }
          });
      await recordAudit(tx, {
        actorId: user.id,
        action: existing ? "risk.reopen" : "risk.create",
        targetType: "RiskLog",
        targetId: risk.id,
        afterState: { category: d.category, severity: d.severity, status: risk.status },
        ...meta
      });
      return risk;
    });

    if (d.clientId) revalidatePath(`/clients/${d.clientId}`);
    return { id: saved.id };
  });
}

/** 리스크 상태 전이(§12). 전이표 강제 + RESOLVED 시 resolvedAt 기록. */
export async function transitionRisk(input: unknown): Promise<ActionResult<{ status: RiskStatus }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1), status: z.enum(RISK_STATUSES) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const before = await db.riskLog.findUnique({ where: { id: p.data.id }, select: { status: true, clientId: true } });
    if (!before) throw new Error("NOT_FOUND");
    if (before.clientId) {
      const c = await db.client.findUnique({ where: { id: before.clientId }, select: { assignedMarketerId: true } });
      const scopes = await getAdminScopes(user);
      assertCanAccessClient(user, before.clientId, scopes, c?.assignedMarketerId ?? null);
    }

    const from = isRiskStatus(before.status) ? before.status : "DETECTED";
    if (from !== p.data.status && !canTransitionRisk(from, p.data.status)) throw new Error("ILLEGAL_TRANSITION");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.riskLog.update({
        where: { id: p.data.id },
        data: {
          status: p.data.status,
          resolvedAt: p.data.status === "RESOLVED" ? new Date() : p.data.status === "DETECTED" ? null : undefined
        }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "risk.transition",
        targetType: "RiskLog",
        targetId: p.data.id,
        beforeState: { status: from },
        afterState: { status: p.data.status },
        ...meta
      });
    });

    if (before.clientId) revalidatePath(`/clients/${before.clientId}`);
    return { status: p.data.status };
  });
}
