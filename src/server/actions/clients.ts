"use server";

import { revalidatePath } from "next/cache";
import { clientInputSchema, type ClientInput } from "@/domain/client-schema";
import { Role } from "@/domain/types";
import type { ActionResult } from "@/server/action-result";
import { AuditActions, writeAuditLog } from "@/server/audit";
import { requireCurrentUser, requireRole } from "@/server/authorization";
import { db } from "@/server/db";
import { AppError, ErrorCodes, runAction } from "@/server/errors";

type ClientAuditState = {
  name: string;
  code: string;
  active: boolean;
  assignedMarketerId: string | null;
  monthlyContractFee: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
};

type ClientRecordLike = {
  name: string;
  code: string;
  active: boolean;
  assignedMarketerId: string | null;
  monthlyContractFee: { toString(): string } | null;
  contractStartDate: Date | null;
  contractEndDate: Date | null;
};

function toAuditState(client: ClientRecordLike): ClientAuditState {
  return {
    name: client.name,
    code: client.code,
    active: client.active,
    assignedMarketerId: client.assignedMarketerId,
    monthlyContractFee: client.monthlyContractFee?.toString() ?? null,
    contractStartDate: client.contractStartDate?.toISOString().slice(0, 10) ?? null,
    contractEndDate: client.contractEndDate?.toISOString().slice(0, 10) ?? null
  };
}

function toDate(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function toClientData(input: ClientInput) {
  return {
    name: input.name,
    code: input.code,
    businessNumber: input.businessNumber ?? null,
    contactName: input.contactName ?? null,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
    contractStartDate: toDate(input.contractStartDate),
    contractEndDate: toDate(input.contractEndDate),
    monthlyContractFee: input.monthlyContractFee ?? null,
    serviceNotes: input.serviceNotes ?? null,
    assignedMarketerId: input.assignedMarketerId ?? null,
    active: input.active
  };
}

async function requireSuperAdmin() {
  return requireRole(await requireCurrentUser(), [Role.SUPER_ADMIN]);
}

async function ensureUniqueCode(code: string, excludeClientId?: string) {
  const existing = await db.client.findUnique({ where: { code }, select: { id: true } });

  if (existing && existing.id !== excludeClientId) {
    throw new AppError(ErrorCodes.CONFLICT, "이미 사용 중인 거래처 코드입니다.", {
      fieldErrors: { code: ["이미 사용 중인 거래처 코드입니다."] }
    });
  }
}

async function ensureAssignableMarketer(marketerId: string) {
  const marketer = await db.user.findUnique({
    where: { id: marketerId },
    select: { id: true, role: true, isActive: true }
  });

  if (!marketer || marketer.role !== Role.MARKETER || !marketer.isActive) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "담당자 배정을 확인해주세요.", {
      fieldErrors: { assignedMarketerId: ["활성 상태의 담당자만 배정할 수 있습니다."] }
    });
  }
}

export async function createClient(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireSuperAdmin();
    const data = clientInputSchema.parse(input);

    await ensureUniqueCode(data.code);

    if (data.assignedMarketerId) {
      await ensureAssignableMarketer(data.assignedMarketerId);
    }

    const client = await db.client.create({ data: toClientData(data) });

    await writeAuditLog({
      actorId: user.id,
      action: AuditActions.CLIENT_CREATED,
      targetType: "Client",
      targetId: client.id,
      afterState: toAuditState(client)
    });

    revalidatePath("/clients");
    return { id: client.id };
  });
}

export async function updateClient(clientId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireSuperAdmin();
    const existing = await db.client.findUnique({ where: { id: clientId } });

    if (!existing) {
      throw new AppError(ErrorCodes.NOT_FOUND, "거래처를 찾을 수 없습니다.");
    }

    const data = clientInputSchema.parse(input);

    await ensureUniqueCode(data.code, clientId);

    if (data.assignedMarketerId) {
      await ensureAssignableMarketer(data.assignedMarketerId);
    }

    const updated = await db.client.update({
      where: { id: clientId },
      data: toClientData(data)
    });

    await writeAuditLog({
      actorId: user.id,
      action: AuditActions.CLIENT_UPDATED,
      targetType: "Client",
      targetId: clientId,
      beforeState: toAuditState(existing),
      afterState: toAuditState(updated)
    });

    revalidatePath("/clients");
    return { id: clientId };
  });
}

export async function setClientActive(clientId: string, active: boolean): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireSuperAdmin();
    const existing = await db.client.findUnique({ where: { id: clientId } });

    if (!existing) {
      throw new AppError(ErrorCodes.NOT_FOUND, "거래처를 찾을 수 없습니다.");
    }

    const updated = await db.client.update({
      where: { id: clientId },
      data: { active }
    });

    await writeAuditLog({
      actorId: user.id,
      action: AuditActions.CLIENT_UPDATED,
      targetType: "Client",
      targetId: clientId,
      beforeState: toAuditState(existing),
      afterState: toAuditState(updated)
    });

    revalidatePath("/clients");
    return { id: clientId };
  });
}

const clientFormKeys = [
  "name",
  "code",
  "businessNumber",
  "contactName",
  "contactEmail",
  "contactPhone",
  "contractStartDate",
  "contractEndDate",
  "monthlyContractFee",
  "serviceNotes",
  "assignedMarketerId"
] as const;

function formDataToClientInput(formData: FormData) {
  const input: Record<string, unknown> = {};

  for (const key of clientFormKeys) {
    const value = formData.get(key);

    if (typeof value === "string") {
      input[key] = value;
    }
  }

  input.active = formData.get("active") ?? "false";
  return input;
}

export async function createClientFormAction(
  _prevState: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  return createClient(formDataToClientInput(formData));
}

export async function updateClientFormAction(
  clientId: string,
  _prevState: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  return updateClient(clientId, formDataToClientInput(formData));
}
