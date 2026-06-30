"use server";

/**
 * 휴가(LeaveRequest) 신청/승인 server action (V2 §4).
 *
 * §1 공통 인프라 사용(runAction/권한 helper/validation/audit).
 *
 * 정책:
 * - 신청: 로그인한 직원이 본인 명의로 신청한다.
 * - 승인/반려: 최고관리자 또는 신청자(담당자)가 scope에 포함된 관리자.
 * - 취소: 본인 신청 건이거나, 승인 권한이 있는 관리자.
 * - 상태 전이는 도메인 전이표(transitionLeave)가 허용하는 경우에만 수행된다.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  leaveRequestFormSchema,
  leaveStatusLabels,
  transitionLeave,
  type LeaveAction
} from "@/domain/leave";
import { Role } from "@/domain/types";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireCurrentUser, requireMarketerAccess, requireRole } from "@/server/authorization";
import { AuditAction, writeAuditLog } from "@/server/audit";
import { conflict, notFound } from "@/server/errors";
import {
  createLeaveRequest,
  decideLeaveRequest,
  getLeaveRequestAccessInfo,
  type LeaveDecisionData
} from "@/server/repositories/leave";

export type LeaveActionState = ActionResult<{ id: string }>;

function formDataToObject(formData: FormData) {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      record[key] = value;
    }
  }
  return record;
}

export async function createLeaveRequestAction(
  _prevState: LeaveActionState | null,
  formData: FormData
): Promise<LeaveActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const input = leaveRequestFormSchema.parse(formDataToObject(formData));

    const created = await createLeaveRequest(input, user.id);

    revalidatePath("/leave");
    return created;
  });
}

const decisionSchema = z.object({
  id: z.string().trim().min(1),
  action: z.enum(["approve", "reject", "cancel"]),
  approvalNotes: z.string().trim().max(500).optional()
});

const decisionAudit: Record<LeaveAction, string> = {
  approve: AuditAction.LEAVE_APPROVED,
  reject: AuditAction.LEAVE_REJECTED,
  cancel: AuditAction.LEAVE_CANCELED
};

export async function decideLeaveRequestAction(
  _prevState: LeaveActionState | null,
  formData: FormData
): Promise<LeaveActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const { id, action, approvalNotes } = decisionSchema.parse(formDataToObject(formData));

    const existing = await getLeaveRequestAccessInfo(id);
    if (!existing) {
      throw notFound("휴가 신청을 찾을 수 없습니다.");
    }

    const isSelf = existing.requesterId === user.id;

    if (action === "cancel") {
      // 본인 취소가 아니면 승인 권한이 있어야 한다.
      if (!isSelf) {
        requireRole(user, [Role.SUPER_ADMIN, Role.ADMIN]);
        await requireMarketerAccess(user, existing.requesterId);
      }
    } else {
      requireRole(user, [Role.SUPER_ADMIN, Role.ADMIN]);
      await requireMarketerAccess(user, existing.requesterId);
    }

    const next = transitionLeave(existing.status, action as LeaveAction);
    if (next === existing.status) {
      throw conflict(`현재 상태(${leaveStatusLabels[existing.status]})에서 수행할 수 없는 작업입니다.`);
    }

    const now = new Date();
    const data: LeaveDecisionData = { status: next };

    if (action === "cancel") {
      data.canceledAt = now;
    } else {
      data.approverId = user.id;
      data.reviewedAt = now;
      data.approvalNotes = approvalNotes ?? null;
    }

    const updated = await decideLeaveRequest(id, data);

    await writeAuditLog({
      actorId: user.id,
      action: decisionAudit[action as LeaveAction],
      targetType: "LeaveRequest",
      targetId: updated.id,
      beforeState: { status: existing.status },
      afterState: { status: updated.status }
    });

    revalidatePath("/leave");
    return { id: updated.id };
  });
}
