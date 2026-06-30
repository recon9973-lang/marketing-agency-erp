import { Role } from "@/domain/types";
import type { CurrentUser } from "@/server/session";

/**
 * 테스트용 현재 사용자 fixture (V2 §1 테스트 인프라).
 * 역할별 기본값을 제공하고 overrides로 일부 필드를 덮어쓴다.
 */
export function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "user-test",
    name: "Test User",
    email: "test@agency.test",
    role: Role.ADMIN,
    ...overrides
  };
}

export function superAdminUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return makeUser({ id: "super-admin-1", name: "Super Admin", role: Role.SUPER_ADMIN, ...overrides });
}

export function adminUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return makeUser({ id: "admin-1", name: "Admin", role: Role.ADMIN, ...overrides });
}

export function marketerUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return makeUser({ id: "marketer-1", name: "Marketer", role: Role.MARKETER, ...overrides });
}
