// V2 §1 공통 인프라 — 서버 권한 helper
//
// 각 저장소와 server action에서 권한 체크가 누락되지 않도록 공통 helper를 제공한다.
// 관리자 scope 규칙은 domain/access-control 을 재사용하고, 여기서는 실패 시 표준
// AppError(FORBIDDEN)를 던지는 얇은 래퍼를 둔다.

import { Role } from "@/domain/types";
import {
  canAccessClient,
  canAccessMarketer,
  type AccessScopeRecord,
  type CurrentUser,
} from "@/domain/access-control";
import { AppError } from "./errors";

// 세션에서 얻은 사용자를 non-null 로 좁힌다. 없으면 FORBIDDEN.
export function requireCurrentUser(user: CurrentUser | null | undefined): CurrentUser {
  if (!user) throw AppError.forbidden("로그인이 필요합니다.");
  return user;
}

export function requireRole(user: CurrentUser, roles: Role[]): void {
  if (!roles.includes(user.role)) {
    throw AppError.forbidden("이 작업을 수행할 권한이 없습니다.");
  }
}

export function requireClientAccess(
  user: CurrentUser,
  clientId: string,
  scopes: AccessScopeRecord[],
  assignedMarketerId?: string | null
): void {
  if (!canAccessClient(user, clientId, scopes, assignedMarketerId)) {
    throw AppError.forbidden("해당 거래처에 접근할 수 없습니다.");
  }
}

export function requireMarketerAccess(
  user: CurrentUser,
  marketerId: string,
  scopes: AccessScopeRecord[]
): void {
  if (!canAccessMarketer(user, marketerId, scopes)) {
    throw AppError.forbidden("해당 담당자 정보에 접근할 수 없습니다.");
  }
}

// 관리자 접근 scope 조회 공통화: 특정 관리자에게 부여된 scope만 추린다.
export function scopesForAdmin(
  adminId: string,
  scopes: AccessScopeRecord[]
): AccessScopeRecord[] {
  return scopes.filter((scope) => scope.adminId === adminId);
}
