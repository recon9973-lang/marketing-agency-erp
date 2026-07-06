// V2 §1 공통 인프라 — 감사 로그 저장 기반
//
// V1의 buildAuditEvent(순수 이벤트 생성)를 유지하면서, 실제 저장 흐름(writeAuditLog)을
// 추가한다. 업무 상태 변경·휴가 승인·청구/입금 수정·지출 검토·보고서 승인 등 민감 작업이
// 기록되게 한다.

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

// 표준 audit action 상수 (민감 작업 유형).
export const AuditAction = {
  CLIENT_CREATED: "CLIENT_CREATED",
  CLIENT_UPDATED: "CLIENT_UPDATED",
  WORK_STATUS_CHANGED: "WORK_STATUS_CHANGED",
  LEAVE_APPROVED: "LEAVE_APPROVED",
  LEAVE_REJECTED: "LEAVE_REJECTED",
  BILLING_UPDATED: "BILLING_UPDATED",
  PAYMENT_UPDATED: "PAYMENT_UPDATED",
  EXPENSE_REVIEWED: "EXPENSE_REVIEWED",
  REPORT_APPROVED: "REPORT_APPROVED",
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

// before/after 상태를 포함한 저장 입력.
export type AuditLogInput = {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  summary?: string;
  beforeState?: unknown;
  afterState?: unknown;
};

// 저장 계층 인터페이스 — Prisma 저장소나 테스트 mock 이 구현한다.
export type AuditLogRecord = AuditLogInput & { createdAt: Date };
export interface AuditLogRepository {
  create(record: AuditLogRecord): Promise<void>;
}

// 정책: audit 저장 실패는 사용자 작업을 막지 않는다(로그만 실패 처리).
// 민감 작업의 원자성이 필요한 경우 호출부에서 트랜잭션으로 감싼다.
export async function writeAuditLog(
  repo: AuditLogRepository,
  input: AuditLogInput
): Promise<{ written: boolean }> {
  const record: AuditLogRecord = { ...input, createdAt: new Date() };
  try {
    await repo.create(record);
    return { written: true };
  } catch {
    // 감사 로그 실패가 본 작업을 막지 않도록 삼킨다(운영 로거로 대체 가능).
    return { written: false };
  }
}

// 테스트/개발용 in-memory 저장소.
export function createMockAuditRepository(): AuditLogRepository & { records: AuditLogRecord[] } {
  const records: AuditLogRecord[] = [];
  return {
    records,
    async create(record) {
      records.push(record);
    },
  };
}
