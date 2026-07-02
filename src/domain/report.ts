/**
 * 보고서(Report) 도메인 규칙 (V2 §6).
 *
 * 상태 흐름: DRAFT → REVIEW_NEEDED → APPROVED → DELIVERED.
 * 검토 단계에서 반려(return)하면 DRAFT로 되돌린다.
 */
import { z } from "zod";
import { ReportStatus } from "@/domain/types";
import { isoDateSchema, optionalString, requiredString } from "@/domain/validation";

export type ReportAction = "submit" | "approve" | "deliver" | "return";

const transitionMap: Record<ReportAction, Partial<Record<ReportStatus, ReportStatus>>> = {
  submit: { [ReportStatus.DRAFT]: ReportStatus.REVIEW_NEEDED },
  approve: { [ReportStatus.REVIEW_NEEDED]: ReportStatus.APPROVED },
  deliver: { [ReportStatus.APPROVED]: ReportStatus.DELIVERED },
  return: { [ReportStatus.REVIEW_NEEDED]: ReportStatus.DRAFT }
};

export function nextReportStatus(current: ReportStatus, action: ReportAction): ReportStatus {
  return transitionMap[action][current] ?? current;
}

/** approve/deliver/return은 검토 권한자(관리자/최고관리자)만 수행한다. */
export const reviewerOnlyActions: ReportAction[] = ["approve", "deliver", "return"];

/** 보고서 작성/수정 입력 검증. */
export const reportFormSchema = z.object({
  clientId: requiredString("거래처", 60),
  reportingMonth: isoDateSchema,
  title: requiredString("제목", 200),
  notes: optionalString(2000)
});

export type ReportFormInput = z.infer<typeof reportFormSchema>;
