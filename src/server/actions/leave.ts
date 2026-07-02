"use server";

import { revalidatePath } from "next/cache";
import { calculateRemainingLeave, transitionLeave } from "@/domain/leave";
import { leaveDecisionSchema, leaveRequestInputSchema } from "@/domain/leave-schema";
import { LeaveStatus, Role } from "@/domain/types";
import type { ActionResult } from "@/server/action-result";
import { AuditActions, writeAuditLog } from "@/server/audit";
import { fetchAccessScopes, requireCurrentUser, requireRole } from "@/server/authorization";
import { canAccessMarketer } from "@/domain/access-control";
import { db } from "@/server/db";
import { AppError, ErrorCodes, runAction } from "@/server/errors";

type LeaveRecordLike = {
  requesterId: string;
  type: string;
  status: LeaveStatus;
  startDate: Date;
  endDate: Date;
  daysRequested: { toNumber(): number } | number;
  reason: string | null;
};

function toDays(value: { toNumber(): number } | number) {
  return typeof value === "number" ? value : value.toNumber();
}

function toAuditState(request: LeaveRecordLike) {
  return {
    requesterId: request.requesterId,
    type: request.type,
    status: request.status,
    startDate: request.startDate.toISOString().slice(0, 10),
    endDate: request.endDate.toISOString().slice(0, 10),
    daysRequested: toDays(request.daysRequested),
    reason: request.reason
  };
}

async function ensureLeaveBalance(requesterId: string, startDate: string, daysRequested: number) {
  const year = Number(startDate.slice(0, 4));
  const policy = await db.leavePolicy.findUnique({
    where: { userId_year: { userId: requesterId, year } },
    select: { annualDays: true, carryOverDays: true }
  });

  // 정책이 아직 등록되지 않은 연도는 잔여 확인 없이 신청을 받고 승인자가 판단한다.
  if (!policy) {
    return;
  }

  const approvedRequests = await db.leaveRequest.findMany({
    where: {
      requesterId,
      status: LeaveStatus.APPROVED,
      startDate: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lte: new Date(`${year}-12-31T23:59:59.999Z`)
      }
    },
    select: { daysRequested: true, status: true }
  });

  const allowance = Number(policy.annualDays) + Number(policy.carryOverDays);
  const remaining = calculateRemainingLeave(
    allowance,
    approvedRequests.map((request) => ({ days: toDays(request.daysRequested), status: request.status }))
  );

  if (daysRequested > remaining) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "잔여 연차를 초과했습니다.", {
      fieldErrors: { daysRequested: [`잔여 연차(${remaining}일)를 초과해 신청할 수 없습니다.`] }
    });
  }
}

async function findLeaveRequestOrThrow(leaveRequestId: string) {
  const request = await db.leaveRequest.findUnique({ where: { id: leaveRequestId } });

  if (!request) {
    throw new AppError(ErrorCodes.NOT_FOUND, "휴가 신청을 찾을 수 없습니다.");
  }

  return request;
}

export async function requestLeave(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const data = leaveRequestInputSchema.parse(input);

    await ensureLeaveBalance(user.id, data.startDate, data.daysRequested);

    const year = Number(data.startDate.slice(0, 4));
    const policy = await db.leavePolicy.findUnique({
      where: { userId_year: { userId: user.id, year } },
      select: { id: true }
    });

    const request = await db.leaveRequest.create({
      data: {
        requesterId: user.id,
        leavePolicyId: policy?.id ?? null,
        type: data.type,
        status: LeaveStatus.REQUESTED,
        startDate: new Date(`${data.startDate}T00:00:00.000Z`),
        endDate: new Date(`${data.endDate}T00:00:00.000Z`),
        daysRequested: data.daysRequested,
        reason: data.reason ?? null
      }
    });

    await writeAuditLog({
      actorId: user.id,
      action: AuditActions.LEAVE_REQUESTED,
      targetType: "LeaveRequest",
      targetId: request.id,
      afterState: toAuditState(request)
    });

    revalidatePath("/leave");
    return { id: request.id };
  });
}

export async function decideLeave(leaveRequestId: string, input: unknown): Promise<ActionResult<{ id: string; status: LeaveStatus }>> {
  return runAction(async () => {
    const user = requireRole(await requireCurrentUser(), [Role.SUPER_ADMIN, Role.ADMIN]);
    const data = leaveDecisionSchema.parse(input);
    const existing = await findLeaveRequestOrThrow(leaveRequestId);

    if (existing.requesterId === user.id) {
      throw new AppError(ErrorCodes.FORBIDDEN, "본인 휴가 신청은 직접 처리할 수 없습니다.");
    }

    const scopes = await fetchAccessScopes(user);

    if (!canAccessMarketer(user, existing.requesterId, scopes)) {
      throw new AppError(ErrorCodes.FORBIDDEN);
    }

    const nextStatus = transitionLeave(existing.status, data.action);

    if (nextStatus === existing.status) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "현재 상태에서 처리할 수 없는 신청입니다.");
    }

    const updated = await db.leaveRequest.update({
      where: { id: leaveRequestId },
      data: {
        status: nextStatus,
        approverId: user.id,
        reviewedAt: new Date(),
        approvalNotes: data.approvalNotes ?? null
      }
    });

    await writeAuditLog({
      actorId: user.id,
      action: data.action === "approve" ? AuditActions.LEAVE_APPROVED : AuditActions.LEAVE_REJECTED,
      targetType: "LeaveRequest",
      targetId: leaveRequestId,
      beforeState: { status: existing.status },
      afterState: { status: updated.status, approvalNotes: data.approvalNotes ?? null }
    });

    revalidatePath("/leave");
    return { id: leaveRequestId, status: updated.status };
  });
}

export async function cancelLeave(leaveRequestId: string): Promise<ActionResult<{ id: string; status: LeaveStatus }>> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const existing = await findLeaveRequestOrThrow(leaveRequestId);

    if (existing.requesterId !== user.id) {
      throw new AppError(ErrorCodes.FORBIDDEN, "본인 휴가 신청만 취소할 수 있습니다.");
    }

    const nextStatus = transitionLeave(existing.status, "cancel");

    if (nextStatus === existing.status) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "현재 상태에서 취소할 수 없는 신청입니다.");
    }

    const updated = await db.leaveRequest.update({
      where: { id: leaveRequestId },
      data: { status: nextStatus, canceledAt: new Date() }
    });

    await writeAuditLog({
      actorId: user.id,
      action: AuditActions.LEAVE_CANCELED,
      targetType: "LeaveRequest",
      targetId: leaveRequestId,
      beforeState: { status: existing.status },
      afterState: { status: updated.status }
    });

    revalidatePath("/leave");
    return { id: leaveRequestId, status: updated.status };
  });
}

const leaveFormKeys = ["type", "startDate", "endDate", "daysRequested", "reason"] as const;

function formDataToLeaveInput(formData: FormData) {
  const input: Record<string, unknown> = {};

  for (const key of leaveFormKeys) {
    const value = formData.get(key);

    if (typeof value === "string") {
      input[key] = value;
    }
  }

  return input;
}

export async function requestLeaveFormAction(
  _prevState: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  return requestLeave(formDataToLeaveInput(formData));
}
