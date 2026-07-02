import type { AuditLogRecord, AuditLogRepository } from "@/server/audit";

/**
 * In-memory 감사 로그 저장소 mock (V2 §1 테스트 인프라).
 * 기록된 레코드를 `records`로 확인할 수 있다.
 */
export function createMockAuditRepository() {
  const records: AuditLogRecord[] = [];

  const repository: AuditLogRepository = {
    async create(data) {
      records.push(data);
      return data;
    }
  };

  return { repository, records };
}

/**
 * 항상 실패하는 감사 로그 저장소 mock.
 * 감사 로그 실패가 주 작업을 막지 않는지 검증할 때 사용한다.
 */
export function createFailingAuditRepository(error: Error = new Error("audit write failed")) {
  const repository: AuditLogRepository = {
    async create() {
      throw error;
    }
  };

  return { repository, error };
}
