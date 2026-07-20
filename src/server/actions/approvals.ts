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

// 3단 결재 체인 컬럼 자가치유(마이그레이션 지연 대비·멱등).
async function ensureChainCols(): Promise<void> {
  try {
    await db.$executeRawUnsafe(`ALTER TABLE "Approval" ADD COLUMN IF NOT EXISTS "stage" TEXT NOT NULL DEFAULT 'L1'`);
    await db.$executeRawUnsafe(`ALTER TABLE "Approval" ADD COLUMN IF NOT EXISTS "l1ApproverId" TEXT`);
    await db.$executeRawUnsafe(`ALTER TABLE "Approval" ADD COLUMN IF NOT EXISTS "l1DecidedAt" TIMESTAMP(3)`);
    await db.$executeRawUnsafe(`ALTER TABLE "Approval" ADD COLUMN IF NOT EXISTS "l1Comment" TEXT`);
  } catch (e) {
    console.warn("[approvals] 체인 컬럼 보장 실패(무시):", String(e).slice(0, 140));
  }
}

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

    await ensureChainCols();
    const meta = await requestMeta();
    const orgId = await getDefaultOrgId();
    // 담당자 요청 → L1(관리자 검토)부터, 관리자·최고관리자 요청 → L2(최고관리자 최종)부터.
    const stage = user.role === Role.MARKETER ? "L1" : "L2";
    const created = await db.$transaction(async (tx) => {
      const approval = await tx.approval.create({
        data: { targetType: d.targetType, targetId: d.targetId, title: d.title, clientId: d.clientId || null, requesterId: user.id, orgId, stage }
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

    await ensureChainCols();
    const approval = await db.approval.findUnique({ where: { id: p.data.id } });
    if (!approval) throw new Error("NOT_FOUND");
    if (approval.status !== "PENDING") throw new Error("ALREADY_DECIDED");

    const isSuper = user.role === Role.SUPER_ADMIN;
    const stage = approval.stage ?? "L2"; // 레거시(null) → 최고관리자 최종
    const now = new Date();
    const comment = p.data.comment || null;

    // 결과 판정: 반려는 즉시 종료 / 관리자 L1 승인은 최고관리자로 에스컬레이션 / 최고관리자 승인은 최종.
    let finalStatus: "PENDING" | "APPROVED" | "REJECTED" = "PENDING";
    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      if (p.data.status === "REJECTED") {
        finalStatus = "REJECTED";
        await tx.approval.update({ where: { id: p.data.id }, data: { status: "REJECTED", approverId: user.id, comment, decidedAt: now } });
      } else if (stage === "L1" && !isSuper) {
        // 관리자(L1) 승인 → 최고관리자(L2) 최종 대기로 승격(status는 PENDING 유지).
        await tx.approval.update({ where: { id: p.data.id }, data: { stage: "L2", l1ApproverId: user.id, l1DecidedAt: now, l1Comment: comment } });
      } else {
        // 최고관리자 최종 승인(또는 L1에서 최고관리자가 바로 최종).
        if (!isSuper) throw new Error("NEED_SUPER_ADMIN");
        finalStatus = "APPROVED";
        await tx.approval.update({
          where: { id: p.data.id },
          data: { status: "APPROVED", approverId: user.id, comment, decidedAt: now, ...(stage === "L1" ? { l1ApproverId: user.id, l1DecidedAt: now } : {}) }
        });
      }
      // 최종 결정 시에만 콘텐츠 기획안 상태 전이.
      if (finalStatus !== "PENDING" && approval.targetType === "CONTENT") {
        await tx.contentPlan
          .update({ where: { id: approval.targetId }, data: { status: finalStatus === "APPROVED" ? "APPROVED" : "REVIEWED" } })
          .catch(() => undefined);
      }
      await recordAudit(tx, { actorId: user.id, action: "approval.decide", targetType: "Approval", targetId: p.data.id, afterState: { status: p.data.status, stage }, ...meta });
    });

    revalidatePath("/approvals");
    if (approval.clientId) revalidatePath(`/clients/${approval.clientId}`);
  });
}
