"use server";

import { revalidatePath } from "next/cache";
import { nextWorkStatus } from "@/domain/work";
import { workItemInputSchema, workStatusActionSchema, type WorkItemInput } from "@/domain/work-schema";
import { Role, WorkStatus } from "@/domain/types";
import type { ActionResult } from "@/server/action-result";
import { AuditActions, writeAuditLog } from "@/server/audit";
import { requireCurrentUser, requireRole, requireWorkAccess } from "@/server/authorization";
import { db } from "@/server/db";
import { AppError, ErrorCodes, runAction } from "@/server/errors";

type WorkRecordLike = {
  title: string;
  clientId: string;
  ownerId: string;
  category: string;
  status: WorkStatus;
  priority: number;
  dueDate: Date | null;
  progressNotes: string | null;
};

function toAuditState(work: WorkRecordLike) {
  return {
    title: work.title,
    clientId: work.clientId,
    ownerId: work.ownerId,
    category: work.category,
    status: work.status,
    priority: work.priority,
    dueDate: work.dueDate?.toISOString().slice(0, 10) ?? null,
    progressNotes: work.progressNotes
  };
}

function toWorkData(input: WorkItemInput) {
  return {
    title: input.title,
    clientId: input.clientId,
    ownerId: input.ownerId,
    category: input.category,
    priority: input.priority,
    dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
    progressNotes: input.progressNotes ?? null
  };
}

async function ensureActiveMarketerOwner(ownerId: string) {
  const owner = await db.user.findUnique({
    where: { id: ownerId },
    select: { id: true, role: true, isActive: true }
  });

  if (!owner || owner.role !== Role.MARKETER || !owner.isActive) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "업무 담당자를 확인해주세요.", {
      fieldErrors: { ownerId: ["활성 상태의 담당자만 지정할 수 있습니다."] }
    });
  }
}

async function findWorkItemOrThrow(workItemId: string) {
  const workItem = await db.workItem.findUnique({ where: { id: workItemId } });

  if (!workItem) {
    throw new AppError(ErrorCodes.NOT_FOUND, "업무를 찾을 수 없습니다.");
  }

  return workItem;
}

export async function createWorkItem(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const data = workItemInputSchema.parse(input);

    await ensureActiveMarketerOwner(data.ownerId);
    await requireWorkAccess(user, { clientId: data.clientId, ownerId: data.ownerId });

    const workItem = await db.workItem.create({
      data: { ...toWorkData(data), createdById: user.id }
    });

    await writeAuditLog({
      actorId: user.id,
      action: AuditActions.WORK_CREATED,
      targetType: "WorkItem",
      targetId: workItem.id,
      afterState: toAuditState(workItem)
    });

    revalidatePath("/work");
    return { id: workItem.id };
  });
}

export async function updateWorkItem(workItemId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const existing = await findWorkItemOrThrow(workItemId);

    await requireWorkAccess(user, { clientId: existing.clientId, ownerId: existing.ownerId });

    const data = workItemInputSchema.parse(input);

    await ensureActiveMarketerOwner(data.ownerId);

    if (data.clientId !== existing.clientId || data.ownerId !== existing.ownerId) {
      await requireWorkAccess(user, { clientId: data.clientId, ownerId: data.ownerId });
    }

    const updated = await db.workItem.update({
      where: { id: workItemId },
      data: toWorkData(data)
    });

    await writeAuditLog({
      actorId: user.id,
      action: AuditActions.WORK_UPDATED,
      targetType: "WorkItem",
      targetId: workItemId,
      beforeState: toAuditState(existing),
      afterState: toAuditState(updated)
    });

    revalidatePath("/work");
    return { id: workItemId };
  });
}

export async function changeWorkStatus(workItemId: string, action: unknown): Promise<ActionResult<{ id: string; status: WorkStatus }>> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const statusAction = workStatusActionSchema.parse(action);
    const existing = await findWorkItemOrThrow(workItemId);

    await requireWorkAccess(user, { clientId: existing.clientId, ownerId: existing.ownerId });

    // 검수 승인(완료 처리)은 관리자 이상만 가능하다.
    if (statusAction === "approve") {
      requireRole(user, [Role.SUPER_ADMIN, Role.ADMIN]);
    }

    const nextStatus = nextWorkStatus(existing.status, statusAction);

    if (nextStatus === existing.status) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, "현재 상태에서 허용되지 않는 상태 변경입니다.");
    }

    const updated = await db.workItem.update({
      where: { id: workItemId },
      data: {
        status: nextStatus,
        startedAt: nextStatus === WorkStatus.IN_PROGRESS && !existing.startedAt ? new Date() : existing.startedAt,
        completedAt: nextStatus === WorkStatus.COMPLETED ? new Date() : null
      }
    });

    await writeAuditLog({
      actorId: user.id,
      action: AuditActions.WORK_STATUS_CHANGED,
      targetType: "WorkItem",
      targetId: workItemId,
      beforeState: { status: existing.status },
      afterState: { status: updated.status }
    });

    revalidatePath("/work");
    return { id: workItemId, status: updated.status };
  });
}

const workFormKeys = ["title", "clientId", "ownerId", "category", "priority", "dueDate", "progressNotes"] as const;

function formDataToWorkInput(formData: FormData) {
  const input: Record<string, unknown> = {};

  for (const key of workFormKeys) {
    const value = formData.get(key);

    if (typeof value === "string") {
      input[key] = value;
    }
  }

  return input;
}

export async function createWorkItemFormAction(
  _prevState: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  return createWorkItem(formDataToWorkInput(formData));
}

export async function updateWorkItemFormAction(
  workItemId: string,
  _prevState: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  return updateWorkItem(workItemId, formDataToWorkInput(formData));
}
