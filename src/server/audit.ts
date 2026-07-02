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

export const AuditActions = {
  CLIENT_CREATED: "CLIENT_CREATED",
  CLIENT_UPDATED: "CLIENT_UPDATED",
  WORK_CREATED: "WORK_CREATED",
  WORK_UPDATED: "WORK_UPDATED",
  WORK_STATUS_CHANGED: "WORK_STATUS_CHANGED",
  LEAVE_REQUESTED: "LEAVE_REQUESTED",
  LEAVE_APPROVED: "LEAVE_APPROVED",
  LEAVE_REJECTED: "LEAVE_REJECTED",
  BILLING_UPDATED: "BILLING_UPDATED",
  PAYMENT_UPDATED: "PAYMENT_UPDATED",
  EXPENSE_REVIEWED: "EXPENSE_REVIEWED",
  REPORT_SUBMITTED: "REPORT_SUBMITTED",
  REPORT_APPROVED: "REPORT_APPROVED",
  ACCESS_SCOPE_UPDATED: "ACCESS_SCOPE_UPDATED",
  STAFF_UPDATED: "STAFF_UPDATED"
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

export type WriteAuditLogInput = {
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

export type AuditLogRepository = {
  create: (record: AuditLogRecord) => Promise<unknown>;
};

export type WriteAuditLogResult = { ok: true } | { ok: false; error: unknown };

export function buildAuditSummary(input: Pick<WriteAuditLogInput, "actorId" | "action" | "targetType" | "targetId">) {
  return `${input.action} ${input.targetType}#${input.targetId} by ${input.actorId ?? "system"}`;
}

async function defaultAuditLogRepository(): Promise<AuditLogRepository> {
  const { db } = await import("@/server/db");

  return {
    create: (record) =>
      db.auditLog.create({
        data: {
          actorId: record.actorId,
          action: record.action,
          targetType: record.targetType,
          targetId: record.targetId,
          beforeState: (record.beforeState ?? undefined) as never,
          afterState: (record.afterState ?? undefined) as never,
          ipAddress: record.ipAddress ?? undefined,
          userAgent: record.userAgent ?? undefined
        }
      })
  };
}

// 정책: 감사 로그 저장 실패는 사용자 작업을 막지 않는다(log-only failure).
// writeAuditLog는 절대 throw 하지 않고 실패를 결과 값과 서버 로그로만 남긴다.
// 자세한 배경은 docs/audit-log-policy.md 참고.
export async function writeAuditLog(
  input: WriteAuditLogInput,
  repository?: AuditLogRepository
): Promise<WriteAuditLogResult> {
  try {
    const repo = repository ?? (await defaultAuditLogRepository());

    await repo.create({
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      beforeState: input.beforeState,
      afterState: input.afterState,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });

    return { ok: true };
  } catch (error) {
    console.error(`[audit] failed to write audit log: ${buildAuditSummary(input)}`, error);
    return { ok: false, error };
  }
}
