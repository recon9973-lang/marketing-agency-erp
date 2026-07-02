/**
 * 관리자 access scope 조회/where-builder 공통화 (V2 §1).
 *
 * 각 저장소(repository)와 server action이 동일한 방식으로 관리자 scope를 불러오고,
 * 동일한 규칙으로 Prisma where 절을 만들 수 있게 한다.
 */
import type { AccessScopeRecord, CurrentUser } from "@/domain/access-control";
import { Role } from "@/domain/types";
import { db } from "@/server/db";

const SCOPE_SELECT = {
  adminId: true,
  marketerId: true,
  clientId: true,
  allMarketers: true,
  allClients: true
} as const;

/**
 * 관리자(ADMIN)의 access scope를 불러온다.
 * SUPER_ADMIN/MARKETER는 scope 기반 제한을 사용하지 않으므로 빈 배열을 반환한다.
 */
export async function loadAccessScopes(user: CurrentUser): Promise<AccessScopeRecord[]> {
  if (user.role !== Role.ADMIN) {
    return [];
  }

  return db.accessScope.findMany({
    where: { adminId: user.id },
    select: SCOPE_SELECT
  });
}

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

/**
 * 사용자가 접근 가능한 거래처를 한정하는 Prisma where 절을 만든다.
 * - SUPER_ADMIN: 전체 (`{}`)
 * - MARKETER: 본인 담당 거래처만
 * - ADMIN: 지정된 거래처 + (지정 담당자 또는 전체 담당자)의 거래처
 * - 접근 가능한 범위가 없으면 어떤 행도 매칭하지 않는 절을 반환한다.
 */
export function buildAccessibleClientWhere(user: CurrentUser, scopes: AccessScopeRecord[]) {
  if (user.role === Role.SUPER_ADMIN) {
    return {};
  }

  if (user.role === Role.MARKETER) {
    return { assignedMarketerId: user.id };
  }

  const ownScopes = scopes.filter((scope) => scope.adminId === user.id);

  if (ownScopes.some((scope) => scope.allClients)) {
    return {};
  }

  const clientIds = unique(ownScopes.map((scope) => scope.clientId));
  const marketerIds = unique(ownScopes.map((scope) => scope.marketerId));
  const hasAllMarketers = ownScopes.some((scope) => scope.allMarketers);

  const clauses: Array<Record<string, unknown>> = [];

  if (clientIds.length > 0) {
    clauses.push({ id: { in: clientIds } });
  }

  if (hasAllMarketers) {
    clauses.push({ assignedMarketerId: { not: null } });
  } else if (marketerIds.length > 0) {
    clauses.push({ assignedMarketerId: { in: marketerIds } });
  }

  return clauses.length > 0 ? { OR: clauses } : { id: { in: [] } };
}
