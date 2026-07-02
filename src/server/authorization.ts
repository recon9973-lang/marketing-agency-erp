/**
 * 서버 권한 helper 정비 (V2 §1).
 *
 * 각 저장소와 server action에서 권한 체크가 누락되지 않도록 공통 helper를 제공한다.
 * 도메인 규칙(`@/domain/access-control`)은 순수 함수로 유지하고, 이 모듈은
 * 현재 사용자 확인과 scope 조회를 결합해 표준 `AppError`를 던진다.
 */
import {
  canAccessClient,
  canAccessMarketer,
  hasRole,
  type AccessScopeRecord,
  type CurrentUser
} from "@/domain/access-control";
import { Role } from "@/domain/types";
import { forbidden, unauthenticated } from "@/server/errors";
import { loadAccessScopes } from "@/server/scope";
import { getCurrentUser } from "@/server/session";

/**
 * 현재 로그인한 직원 사용자를 반환한다. 없으면 UNAUTHENTICATED를 던진다.
 * server action 시작부에서 사용한다.
 */
export async function requireCurrentUser(requestedDevRole?: unknown): Promise<CurrentUser> {
  const user = await getCurrentUser(requestedDevRole);

  if (!user) {
    throw unauthenticated();
  }

  return user;
}

/**
 * 사용자가 허용된 역할 중 하나인지 확인한다. 아니면 FORBIDDEN을 던진다.
 */
export function requireRole(user: CurrentUser, roles: Role[]): void {
  if (!hasRole(user, roles)) {
    throw forbidden();
  }
}

/**
 * 사용자가 특정 담당자(marketer) 정보를 다룰 권한이 있는지 확인한다.
 * scope를 직접 넘기면 DB 조회 없이 평가한다(테스트/배치 처리에 유용).
 */
export async function requireMarketerAccess(
  user: CurrentUser,
  marketerId: string,
  scopes?: AccessScopeRecord[]
): Promise<void> {
  const resolvedScopes = scopes ?? (await loadAccessScopes(user));

  if (!canAccessMarketer(user, marketerId, resolvedScopes)) {
    throw forbidden();
  }
}

export type ClientAccessOptions = {
  assignedMarketerId?: string | null;
  scopes?: AccessScopeRecord[];
};

/**
 * 사용자가 특정 거래처(client)를 다룰 권한이 있는지 확인한다.
 * `assignedMarketerId`를 넘기면 담당자 기반 접근까지 평가한다.
 */
export async function requireClientAccess(
  user: CurrentUser,
  clientId: string,
  options: ClientAccessOptions = {}
): Promise<void> {
  const resolvedScopes = options.scopes ?? (await loadAccessScopes(user));

  if (!canAccessClient(user, clientId, resolvedScopes, options.assignedMarketerId)) {
    throw forbidden();
  }
}
