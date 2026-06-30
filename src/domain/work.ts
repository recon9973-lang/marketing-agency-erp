import { z } from "zod";
import { WorkCategory, WorkStatus } from "@/domain/types";
import { enumSchema, isoDateSchema, optionalString, requiredString } from "@/domain/validation";

export type WorkStatusAction = "start" | "submit_for_review" | "approve" | "block" | "resume";

const optionalIsoDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  isoDateSchema.optional()
);

/** 업무 생성/수정 입력 검증 (V2 §3). */
export const workFormSchema = z.object({
  clientId: requiredString("거래처", 60),
  ownerId: requiredString("담당자", 60),
  title: requiredString("업무명", 200),
  category: enumSchema(WorkCategory, "업무 카테고리"),
  priority: z.coerce
    .number({ invalid_type_error: "우선순위는 숫자여야 합니다." })
    .int("우선순위는 정수여야 합니다.")
    .min(1, "우선순위는 1~5 사이여야 합니다.")
    .max(5, "우선순위는 1~5 사이여야 합니다."),
  dueDate: optionalIsoDate,
  progressNotes: optionalString(2000),
  resultSummary: optionalString(2000)
});

export type WorkFormInput = z.infer<typeof workFormSchema>;

/**
 * 상태 전이에 따른 타임스탬프 부수효과를 계산한다 (V2 §3).
 * - IN_PROGRESS로 처음 진입하면 startedAt 기록.
 * - COMPLETED로 진입하면 completedAt 기록.
 */
export function workStatusTimestamps(
  nextStatus: WorkStatus,
  current: { startedAt?: Date | null; completedAt?: Date | null },
  now: Date
): { startedAt?: Date; completedAt?: Date } {
  const timestamps: { startedAt?: Date; completedAt?: Date } = {};

  if (nextStatus === WorkStatus.IN_PROGRESS && !current.startedAt) {
    timestamps.startedAt = now;
  }

  if (nextStatus === WorkStatus.COMPLETED && !current.completedAt) {
    timestamps.completedAt = now;
  }

  return timestamps;
}

export type WorkDueInput = {
  status: WorkStatus;
  dueDate?: Date | string | null;
};

const completedStatuses = new Set<WorkStatus>([WorkStatus.COMPLETED]);

const transitionMap: Record<WorkStatusAction, Partial<Record<WorkStatus, WorkStatus>>> = {
  start: {
    [WorkStatus.NOT_STARTED]: WorkStatus.IN_PROGRESS,
    [WorkStatus.WAITING]: WorkStatus.IN_PROGRESS
  },
  submit_for_review: {
    [WorkStatus.IN_PROGRESS]: WorkStatus.REVIEW_NEEDED
  },
  approve: {
    [WorkStatus.REVIEW_NEEDED]: WorkStatus.COMPLETED
  },
  block: {
    [WorkStatus.NOT_STARTED]: WorkStatus.BLOCKED,
    [WorkStatus.IN_PROGRESS]: WorkStatus.BLOCKED,
    [WorkStatus.WAITING]: WorkStatus.BLOCKED,
    [WorkStatus.REVIEW_NEEDED]: WorkStatus.BLOCKED
  },
  resume: {
    [WorkStatus.BLOCKED]: WorkStatus.IN_PROGRESS
  }
};

export const workCategoryLabels: Record<WorkCategory, string> = {
  [WorkCategory.BRAND_BLOG]: "브랜드블로그 작성",
  [WorkCategory.BLOG_DISTRIBUTION]: "블로그배포",
  [WorkCategory.BLOG_SEO]: "블로그상위노출",
  [WorkCategory.RECEIPT_REVIEW]: "영수증리뷰",
  [WorkCategory.PLACE_RANKING]: "플레이스 순위관리",
  [WorkCategory.SNS_MANAGEMENT]: "SNS 관리 및 배포",
  [WorkCategory.ACCOUNT_MANAGEMENT]: "거래처 계정관리",
  [WorkCategory.MONTHLY_REPORT]: "월간 보고서 작성",
  [WorkCategory.PERFORMANCE_COLLECTION]: "방문자수 자료 집계"
};

export const workStatusLabels: Record<WorkStatus, string> = {
  [WorkStatus.NOT_STARTED]: "대기",
  [WorkStatus.IN_PROGRESS]: "진행중",
  [WorkStatus.WAITING]: "보류",
  [WorkStatus.REVIEW_NEEDED]: "검수필요",
  [WorkStatus.COMPLETED]: "완료",
  [WorkStatus.BLOCKED]: "차단"
};

function toDateOnly(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

export function isWorkDelayed(work: WorkDueInput, today: Date | string) {
  if (!work.dueDate || completedStatuses.has(work.status)) {
    return false;
  }

  return toDateOnly(work.dueDate) < toDateOnly(today);
}

export function nextWorkStatus(currentStatus: WorkStatus, action: WorkStatusAction) {
  return transitionMap[action][currentStatus] ?? currentStatus;
}
