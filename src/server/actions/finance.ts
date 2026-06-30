"use server";

/**
 * 청구/입금/지출 server action (V2 §5).
 *
 * §1 공통 인프라 사용(runAction/권한 helper/validation/audit).
 *
 * 정책:
 * - 청구 생성/수정, 입금 기록: 최고관리자 또는 해당 거래처 접근 권한이 있는 관리자.
 * - 지출 등록: 로그인한 직원(거래처를 지정하면 그 거래처 접근 권한 필요).
 * - 지출 검토: 최고관리자 또는 (거래처가 지정된 경우) 그 거래처 접근 권한이 있는 관리자.
 */
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import {
  billingFormSchema,
  expenseFormSchema,
  expenseReviewSchema,
  paymentFormSchema
} from "@/domain/finance";
import { Role } from "@/domain/types";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireClientAccess, requireCurrentUser, requireRole } from "@/server/authorization";
import { AuditAction, writeAuditLog } from "@/server/audit";
import { conflict, notFound } from "@/server/errors";
import { getClientAccessInfo } from "@/server/repositories/clients";
import {
  createBillingRecord,
  createExpenseRecord,
  getBillingAccessInfo,
  getBillingDetail,
  getExpenseAccessInfo,
  recordPayment,
  reviewExpenseRecord,
  updateBillingRecord
} from "@/server/repositories/finance";

export type FinanceActionState = ActionResult<{ id: string }>;

function formDataToObject(formData: FormData) {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      record[key] = value;
    }
  }
  return record;
}

function rethrowAsDomainError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw conflict("이미 등록된 청구입니다(거래처/청구월 또는 인보이스 번호 중복).");
  }
  throw error;
}

export async function createBillingRecordAction(
  _prevState: FinanceActionState | null,
  formData: FormData
): Promise<FinanceActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    requireRole(user, [Role.SUPER_ADMIN, Role.ADMIN]);

    const input = billingFormSchema.parse(formDataToObject(formData));
    const client = await getClientAccessInfo(input.clientId);
    if (!client) {
      throw notFound("거래처를 찾을 수 없습니다.");
    }
    await requireClientAccess(user, input.clientId, { assignedMarketerId: client.assignedMarketerId });

    const created = await createBillingRecord(input, user.id).catch(rethrowAsDomainError);

    await writeAuditLog({
      actorId: user.id,
      action: AuditAction.BILLING_UPDATED,
      targetType: "BillingRecord",
      targetId: created.id,
      afterState: { created: true, issuedAmount: input.issuedAmount }
    });

    revalidatePath("/finance");
    return created;
  });
}

export async function updateBillingRecordAction(
  _prevState: FinanceActionState | null,
  formData: FormData
): Promise<FinanceActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    requireRole(user, [Role.SUPER_ADMIN, Role.ADMIN]);

    const billingId = formDataToObject(formData).id ?? "";
    const existing = await getBillingAccessInfo(billingId);
    if (!existing) {
      throw notFound("청구 내역을 찾을 수 없습니다.");
    }
    await requireClientAccess(user, existing.clientId, { assignedMarketerId: existing.clientAssignedMarketerId });

    const before = await getBillingDetail(billingId);
    const input = billingFormSchema.parse(formDataToObject(formData));

    // 거래처를 변경하는 경우 변경 대상 접근 권한도 확인한다.
    if (input.clientId !== existing.clientId) {
      const target = await getClientAccessInfo(input.clientId);
      if (!target) {
        throw notFound("거래처를 찾을 수 없습니다.");
      }
      await requireClientAccess(user, input.clientId, { assignedMarketerId: target.assignedMarketerId });
    }

    const updated = await updateBillingRecord(billingId, input).catch(rethrowAsDomainError);

    await writeAuditLog({
      actorId: user.id,
      action: AuditAction.BILLING_UPDATED,
      targetType: "BillingRecord",
      targetId: updated.id,
      beforeState: before,
      afterState: input
    });

    revalidatePath("/finance");
    return updated;
  });
}

export async function recordPaymentAction(
  _prevState: FinanceActionState | null,
  formData: FormData
): Promise<FinanceActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    requireRole(user, [Role.SUPER_ADMIN, Role.ADMIN]);

    const input = paymentFormSchema.parse(formDataToObject(formData));
    const billing = await getBillingAccessInfo(input.billingRecordId);
    if (!billing) {
      throw notFound("청구 내역을 찾을 수 없습니다.");
    }
    await requireClientAccess(user, billing.clientId, { assignedMarketerId: billing.clientAssignedMarketerId });

    const result = await recordPayment(input, user.id);

    await writeAuditLog({
      actorId: user.id,
      action: AuditAction.PAYMENT_UPDATED,
      targetType: "BillingRecord",
      targetId: result.billingId,
      afterState: { paymentId: result.id, paidAmount: result.paidAmount, status: result.status }
    });

    revalidatePath("/finance");
    return { id: result.id };
  });
}

export async function createExpenseRecordAction(
  _prevState: FinanceActionState | null,
  formData: FormData
): Promise<FinanceActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const input = expenseFormSchema.parse(formDataToObject(formData));

    if (input.clientId) {
      const client = await getClientAccessInfo(input.clientId);
      if (!client) {
        throw notFound("거래처를 찾을 수 없습니다.");
      }
      await requireClientAccess(user, input.clientId, { assignedMarketerId: client.assignedMarketerId });
    }

    const created = await createExpenseRecord(input, user.id);

    revalidatePath("/finance");
    return created;
  });
}

export async function reviewExpenseAction(
  _prevState: FinanceActionState | null,
  formData: FormData
): Promise<FinanceActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    requireRole(user, [Role.SUPER_ADMIN, Role.ADMIN]);

    const input = expenseReviewSchema.parse(formDataToObject(formData));
    const existing = await getExpenseAccessInfo(input.id);
    if (!existing) {
      throw notFound("지출 내역을 찾을 수 없습니다.");
    }

    if (existing.clientId) {
      await requireClientAccess(user, existing.clientId, { assignedMarketerId: existing.clientAssignedMarketerId });
    }

    const updated = await reviewExpenseRecord(input.id, {
      reviewStatus: input.reviewStatus,
      reviewedById: user.id,
      reviewedAt: new Date(),
      excludedReason: input.excludedReason ?? null
    });

    await writeAuditLog({
      actorId: user.id,
      action: AuditAction.EXPENSE_REVIEWED,
      targetType: "ExpenseRecord",
      targetId: updated.id,
      afterState: { reviewStatus: updated.reviewStatus }
    });

    revalidatePath("/finance");
    return { id: updated.id };
  });
}
