/**
 * 감사 로그 저장 기반 (V2 §1).
 *
 * V1의 `buildAuditEvent`(요약 문자열 생성)를 유지하면서, 실제 DB 저장 흐름인
 * `writeAuditLog`를 추가한다. 업무 상태 변경, 휴가 승인, 청구/입금 수정,
 * 지출 검토, 보고서 승인 같은 민감 작업에서 호출한다.
 *
 * 실패 정책:
 * - 감사 로그 기록은 best-effort 이며 사용자 작업을 막지 않는다.
 * - 저장에 실패하면 서버 로그에 남기고 `false`를 반환하되, 예외를 전파하지 않는다.
 * - 즉, 주 작업(예: 휴가 승인) 자체는 감사 로그 실패와 무관하게 성공 처리된다.
 */
import { logServerError } from "@/server/errors";

export type AuditEventInput = {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
};

export function buildAuditEvent(input: AuditEventInput) {
  return {
    ...input,
    createdAt: new Date()
  };
}

/**
 * 표준 감사 action 상수. 후속 CRUD 작업에서 동일한 값을 재사용한다.
 */
export const AuditAction = {
  WORK_STATUS_CHANGED: "WORK_STATUS_CHANGED",
  LEAVE_APPROVED: "LEAVE_APPROVED",
  LEAVE_REJECTED: "LEAVE_REJECTED",
  LEAVE_CANCELED: "LEAVE_CANCELED",
  BILLING_UPDATED: "BILLING_UPDATED",
  PAYMENT_UPDATED: "PAYMENT_UPDATED",
  EXPENSE_REVIEWED: "EXPENSE_REVIEWED",
  REPORT_SUBMITTED: "REPORT_SUBMITTED",
  REPORT_APPROVED: "REPORT_APPROVED",
  REPORT_RETURNED: "REPORT_RETURNED",
  REPORT_DELIVERED: "REPORT_DELIVERED",
  CLIENT_CREATED: "CLIENT_CREATED",
  CLIENT_UPDATED: "CLIENT_UPDATED",
  PLACE_RANK_RECORDED: "PLACE_RANK_RECORDED",
  PLACE_RANK_DELETED: "PLACE_RANK_DELETED",
  SETTINGS_UPDATED: "SETTINGS_UPDATED"
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export type AuditLogInput = {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AuditLogRecord = {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  beforeState?: unknown;
  afterState?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * 감사 로그 저장소 추상화. 기본 구현은 Prisma의 `auditLog.create`를 사용하고,
 * 테스트에서는 in-memory mock으로 주입할 수 있다.
 */
export type AuditLogRepository = {
  create(data: AuditLogRecord): Promise<unknown>;
};

function toRecord(input: AuditLogInput): AuditLogRecord {
  const record: AuditLogRecord = {
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId
  };

  if (input.beforeState !== undefined) {
    record.beforeState = input.beforeState;
  }

  if (input.afterState !== undefined) {
    record.afterState = input.afterState;
  }

  if (input.ipAddress !== undefined) {
    record.ipAddress = input.ipAddress;
  }

  if (input.userAgent !== undefined) {
    record.userAgent = input.userAgent;
  }

  return record;
}

/**
 * 감사 로그를 저장한다. 성공하면 `true`, 실패하면 `false`(예외 비전파).
 * @param repository 기본값은 Prisma 기반 저장소. 테스트에서는 mock을 주입한다.
 */
export async function writeAuditLog(
  input: AuditLogInput,
  repository?: AuditLogRepository
): Promise<boolean> {
  try {
    const repo = repository ?? (await getDefaultAuditRepository());
    await repo.create(toRecord(input));
    return true;
  } catch (error) {
    logServerError(error, {
      scope: "writeAuditLog",
      action: input.action,
      targetId: input.targetId
    });
    return false;
  }
}

async function getDefaultAuditRepository(): Promise<AuditLogRepository> {
  const { db } = await import("@/server/db");

  return {
    create: (data) =>
      db.auditLog.create({
        data: data as Parameters<typeof db.auditLog.create>[0]["data"]
      })
  };
}
