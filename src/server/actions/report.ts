"use server";

/**
 * 보고서(Report) 작성/승인 server action (V2 §6).
 *
 * §1 공통 인프라 사용(runAction/권한 helper/validation/audit).
 *
 * 정책:
 * - 작성/수정: 거래처 접근 권한이 있는 직원. 수정은 작성자 본인 또는 관리자/최고관리자.
 * - 제출(submit): 작성자 본인 또는 관리자/최고관리자.
 * - 승인/전달/반려: 관리자 또는 최고관리자(검토 권한자).
 * - 상태 전이는 도메인 전이표(nextReportStatus)가 허용하는 경우에만 수행된다.
 */
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  nextReportStatus,
  reportFormSchema,
  reviewerOnlyActions,
  type ReportAction
} from "@/domain/report";
import { Role } from "@/domain/types";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireClientAccess, requireCurrentUser, requireRole } from "@/server/authorization";
import { AuditAction, writeAuditLog } from "@/server/audit";
import { conflict, forbidden, notFound } from "@/server/errors";
import { getClientAccessInfo } from "@/server/repositories/clients";
import {
  changeReportStatus,
  createReport,
  getReportAccessInfo,
  getReportDetail,
  updateReport,
  type ReportStatusData
} from "@/server/repositories/reports";

export type ReportActionState = ActionResult<{ id: string }>;

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
    throw conflict("이미 해당 거래처/월의 보고서가 있습니다.");
  }
  throw error;
}

export async function createReportAction(
  _prevState: ReportActionState | null,
  formData: FormData
): Promise<ReportActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const input = reportFormSchema.parse(formDataToObject(formData));

    const client = await getClientAccessInfo(input.clientId);
    if (!client) {
      throw notFound("거래처를 찾을 수 없습니다.");
    }
    await requireClientAccess(user, input.clientId, { assignedMarketerId: client.assignedMarketerId });

    const created = await createReport(input, user.id).catch(rethrowAsDomainError);

    revalidatePath("/reports");
    return created;
  });
}

export async function updateReportAction(
  _prevState: ReportActionState | null,
  formData: FormData
): Promise<ReportActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const reportId = formDataToObject(formData).id ?? "";

    const existing = await getReportAccessInfo(reportId);
    if (!existing) {
      throw notFound("보고서를 찾을 수 없습니다.");
    }
    await requireClientAccess(user, existing.clientId, { assignedMarketerId: existing.clientAssignedMarketerId });

    const isAuthor = existing.authorId === user.id;
    const isReviewer = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    if (!isAuthor && !isReviewer) {
      throw forbidden();
    }

    const before = await getReportDetail(reportId);
    const input = reportFormSchema.parse(formDataToObject(formData));

    if (input.clientId !== existing.clientId) {
      const target = await getClientAccessInfo(input.clientId);
      if (!target) {
        throw notFound("거래처를 찾을 수 없습니다.");
      }
      await requireClientAccess(user, input.clientId, { assignedMarketerId: target.assignedMarketerId });
    }

    const updated = await updateReport(reportId, input).catch(rethrowAsDomainError);

    await writeAuditLog({
      actorId: user.id,
      action: AuditAction.REPORT_SUBMITTED,
      targetType: "Report",
      targetId: updated.id,
      beforeState: before,
      afterState: input
    });

    revalidatePath("/reports");
    return updated;
  });
}

const statusActionSchema = z.object({
  id: z.string().trim().min(1),
  action: z.enum(["submit", "approve", "deliver", "return"])
});

const reportAudit: Record<ReportAction, string> = {
  submit: AuditAction.REPORT_SUBMITTED,
  approve: AuditAction.REPORT_APPROVED,
  deliver: AuditAction.REPORT_DELIVERED,
  return: AuditAction.REPORT_RETURNED
};

export async function changeReportStatusAction(
  _prevState: ReportActionState | null,
  formData: FormData
): Promise<ReportActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    const { id, action } = statusActionSchema.parse(formDataToObject(formData));

    const existing = await getReportAccessInfo(id);
    if (!existing) {
      throw notFound("보고서를 찾을 수 없습니다.");
    }
    await requireClientAccess(user, existing.clientId, { assignedMarketerId: existing.clientAssignedMarketerId });

    const typedAction = action as ReportAction;
    if (reviewerOnlyActions.includes(typedAction)) {
      requireRole(user, [Role.SUPER_ADMIN, Role.ADMIN]);
    } else if (existing.authorId !== user.id && user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) {
      // submit: 작성자 본인 또는 관리자만
      throw forbidden();
    }

    const next = nextReportStatus(existing.status, typedAction);
    if (next === existing.status) {
      throw conflict("현재 상태에서 수행할 수 없는 작업입니다.");
    }

    const now = new Date();
    const data: ReportStatusData = { status: next };
    if (typedAction === "approve") {
      data.reviewerId = user.id;
      data.reviewedAt = now;
    } else if (typedAction === "deliver") {
      data.deliveredAt = now;
    } else if (typedAction === "return") {
      data.reviewedAt = null;
    }

    const updated = await changeReportStatus(id, data);

    await writeAuditLog({
      actorId: user.id,
      action: reportAudit[typedAction],
      targetType: "Report",
      targetId: updated.id,
      beforeState: { status: existing.status },
      afterState: { status: updated.status }
    });

    revalidatePath("/reports");
    return { id: updated.id };
  });
}
