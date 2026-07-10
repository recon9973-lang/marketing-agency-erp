// 목표 경로: src/server/actions/approvals.ts
//
// 통합 승인 — 계약·견적·원고·콘텐츠 승인 요청/결정. 결정은 관리자(ADMIN) 이상.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role } from "@/domain/types";
import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import {
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";

const TARGET_TYPES = ["CONTRACT", "QUOTE", "CONTENT", "COMPLIANCE"] as const;

const requestSchema = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  clientId: z.string().optional().nullable()
});

export async function requestApproval(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = requestSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    // 동일 대상에 이미 대기 중인 승인이 있으면 그것을 재사용(중복 방지).
    const existing = await db.approval.findFirst({ where: { targetType: d.targetType, targetId: d.targetId, status: "PENDING" }, select: { id: true } });
    if (existing) return { id: existing.id };

    const meta = await requestMeta();
    const orgId = await getDefaultOrgId();
    const created = await db.$transaction(async (tx) => {
      const approval = await tx.approval.create({
        data: { targetType: d.targetType, targetId: d.targetId, title: d.title, clientId: d.clientId || null, requesterId: user.id, orgId }
      });
      await recordAudit(tx, { actorId: user.id, action: "approval.request", targetType: "Approval", targetId: approval.id, afterState: { targetType: d.targetType, targetId: d.targetId }, ...meta });
      return approval;
    });

    revalidatePath("/approvals");
    if (d.clientId) revalidatePath(`/clients/${d.clientId}`);
    return { id: created.id };
  });
}

const decideSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().trim().max(500).optional().nullable()
});

export async function decideApproval(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) throw new Error("FORBIDDEN");
    const p = decideSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const approval = await db.approval.findUnique({ where: { id: p.data.id } });
    if (!approval) throw new Error("NOT_FOUND");
    if (approval.status !== "PENDING") throw new Error("ALREADY_DECIDED");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.approval.update({
        where: { id: p.data.id },
        data: { status: p.data.status, approverId: user.id, comment: p.data.comment || null, decidedAt: new Date() }
      });
      // 콘텐츠 승인 시 기획안 상태도 전이.
      if (approval.targetType === "CONTENT") {
        await tx.contentPlan.update({ where: { id: approval.targetId }, data: { status: p.data.status === "APPROVED" ? "APPROVED" : "REVIEWED" } }).catch(() => undefined);
      }
      await recordAudit(tx, { actorId: user.id, action: "approval.decide", targetType: "Approval", targetId: p.data.id, afterState: { status: p.data.status }, ...meta });
    });

    revalidatePath("/approvals");
    if (approval.clientId) revalidatePath(`/clients/${approval.clientId}`);
  });
}
