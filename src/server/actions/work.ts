"use server";

/**
 * 업무(WorkItem) 생성/수정/상태 전이 server action (V2 §3).
 *
 * §1 공통 인프라를 그대로 사용한다(runAction/권한 helper/validation/audit).
 *
 * 접근 정책:
 * - 업무가 속한 거래처에 접근 권한이 있어야 하고(`requireClientAccess`),
 *   소유자(담당자)에 대한 권한도 있어야 한다(`requireMarketerAccess`).
 * - 담당자(MARKETER)는 자기 거래처/본인이 소유한 업무에만 접근 가능하다.
 * - 상태 전이는 도메인 전이표(`nextWorkStatus`)가 허용하는 경우에만 수행된다.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  nextWorkStatus,
  workFormSchema,
  workStatusLabels,
  workStatusTimestamps,
  type WorkStatusAction
} from "@/domain/work";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireClientAccess, requireCurrentUser, requireMarketerAccess } from "@/server/authorization";
import { AuditAction, writeAuditLog } from "@/server/audit";
import { conflict, notFound } from "@/server/errors";
import { getClientAccessInfo } from "@/server/repositories/clients";
import {
  changeWorkItemStatus,
  createWorkItem,
  getWorkItemAccessInfo,
  getWorkItemDetail,
  updateWorkItem
} from "@/server/repositories/work";
import type { CurrentUser } from "@/domain/access-control";

export type WorkActionState = ActionResult<{ id: string }>;

function formDataToObject(formData: FormData) {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      record[key] = value;
    }
  }
  return record;
}

async function assertWorkAccess(
  user: CurrentUser,
  clientId: string,
  ownerId: string,
  clientAssignedMarketerId: string | null
) {
  await requireClientAccess(user, clientId, { assignedMarketerId: clientAssignedMarketerId });
  await requireMarketerAccess(user, ownerId);
}

export async function createWorkItemAction(
  _prevState: WorkActionState | null,
  formData: FormData
): Promise<WorkActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const input = workFormSchema.parse(formDataToObject(formData));

    const client = await getClientAccessInfo(input.clientId);
    if (!client) {
      throw notFound("거래처를 찾을 수 없습니다.");
    }

    await assertWorkAccess(user, input.clientId, input.ownerId, client.assignedMarketerId);

    const created = await createWorkItem(input, user.id);

    await writeAuditLog({
      actorId: user.id,
      action: AuditAction.WORK_STATUS_CHANGED,
      targetType: "WorkItem",
      targetId: created.id,
      afterState: { created: true, status: "NOT_STARTED", title: input.title }
    });

    revalidatePath("/work");
    return created;
  });
}

export async function updateWorkItemAction(
  _prevState: WorkActionState | null,
  formData: FormData
): Promise<WorkActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const workItemId = formDataToObject(formData).id ?? "";

    const existing = await getWorkItemAccessInfo(workItemId);
    if (!existing) {
      throw notFound("업무를 찾을 수 없습니다.");
    }

    await assertWorkAccess(user, existing.clientId, existing.ownerId, existing.clientAssignedMarketerId);

    const input = workFormSchema.parse(formDataToObject(formData));

    // 거래처/소유자를 변경하는 경우, 변경 대상에 대한 권한도 확인한다.
    if (input.clientId !== existing.clientId || input.ownerId !== existing.ownerId) {
      const targetClient = await getClientAccessInfo(input.clientId);
      if (!targetClient) {
        throw notFound("거래처를 찾을 수 없습니다.");
      }
      await assertWorkAccess(user, input.clientId, input.ownerId, targetClient.assignedMarketerId);
    }

    const before = await getWorkItemDetail(workItemId);
    const updated = await updateWorkItem(workItemId, input);

    await writeAuditLog({
      actorId: user.id,
      action: AuditAction.WORK_STATUS_CHANGED,
      targetType: "WorkItem",
      targetId: updated.id,
      beforeState: before,
      afterState: input
    });

    revalidatePath("/work");
    return updated;
  });
}

const statusActionSchema = z.object({
  id: z.string().trim().min(1),
  action: z.enum(["start", "submit_for_review", "approve", "block", "resume"])
});

export async function changeWorkStatusAction(
  _prevState: WorkActionState | null,
  formData: FormData
): Promise<WorkActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const { id, action } = statusActionSchema.parse(formDataToObject(formData));

    const existing = await getWorkItemAccessInfo(id);
    if (!existing) {
      throw notFound("업무를 찾을 수 없습니다.");
    }

    await assertWorkAccess(user, existing.clientId, existing.ownerId, existing.clientAssignedMarketerId);

    const next = nextWorkStatus(existing.status, action as WorkStatusAction);
    if (next === existing.status) {
      throw conflict(`현재 상태(${workStatusLabels[existing.status]})에서 수행할 수 없는 작업입니다.`);
    }

    const timestamps = workStatusTimestamps(next, existing, new Date());
    const updated = await changeWorkItemStatus(id, next, timestamps);

    await writeAuditLog({
      actorId: user.id,
      action: AuditAction.WORK_STATUS_CHANGED,
      targetType: "WorkItem",
      targetId: updated.id,
      beforeState: { status: existing.status },
      afterState: { status: updated.status }
    });

    revalidatePath("/work");
    return { id: updated.id };
  });
}
