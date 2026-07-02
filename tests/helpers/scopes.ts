import type { AccessScopeRecord } from "@/domain/access-control";

/**
 * 테스트용 access scope fixture (V2 §1 테스트 인프라).
 */
export function makeScope(overrides: Partial<AccessScopeRecord> = {}): AccessScopeRecord {
  return {
    adminId: "admin-1",
    marketerId: null,
    clientId: null,
    allMarketers: false,
    allClients: false,
    ...overrides
  };
}

/** 특정 거래처만 접근 가능한 scope. */
export function clientScope(adminId: string, clientId: string): AccessScopeRecord {
  return makeScope({ adminId, clientId });
}

/** 특정 담당자(및 그 담당자 거래처) 접근 가능한 scope. */
export function marketerScope(adminId: string, marketerId: string): AccessScopeRecord {
  return makeScope({ adminId, marketerId });
}
