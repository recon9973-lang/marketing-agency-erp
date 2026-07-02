import {
  canAccessClient,
  canAccessMarketer,
  type AccessScopeRecord,
  type CurrentUser as AccessControlUser
} from "@/domain/access-control";
import { Role } from "@/domain/types";
import { AppError, ErrorCodes } from "@/server/errors";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

export async function requireCurrentUser(requestedDevRole?: unknown): Promise<CurrentUser> {
  // 지연 import: next-auth에 정적으로 의존하지 않아야 도메인/저장소 테스트에서
  // 이 모듈의 순수 helper들을 그대로 불러 쓸 수 있다.
  const { getCurrentUser } = await import("@/server/session");
  const user = await getCurrentUser(requestedDevRole);

  if (!user) {
    throw new AppError(ErrorCodes.UNAUTHORIZED);
  }

  return user;
}

export function requireRole<User extends AccessControlUser>(user: User, roles: Role[]): User {
  if (!roles.includes(user.role)) {
    throw new AppError(ErrorCodes.FORBIDDEN);
  }

  return user;
}

export async function fetchAccessScopes(user: AccessControlUser): Promise<AccessScopeRecord[]> {
  if (user.role !== Role.ADMIN) {
    return [];
  }

  return db.accessScope.findMany({
    where: { adminId: user.id },
    select: {
      adminId: true,
      marketerId: true,
      clientId: true,
      allMarketers: true,
      allClients: true
    }
  });
}

export async function requireMarketerAccess(
  user: AccessControlUser,
  marketerId: string,
  scopes?: AccessScopeRecord[]
): Promise<void> {
  const resolvedScopes = scopes ?? (await fetchAccessScopes(user));

  if (!canAccessMarketer(user, marketerId, resolvedScopes)) {
    throw new AppError(ErrorCodes.FORBIDDEN);
  }
}

export async function requireClientAccess(
  user: AccessControlUser,
  clientId: string,
  options?: { assignedMarketerId?: string | null; scopes?: AccessScopeRecord[] }
): Promise<void> {
  let assignedMarketerId = options?.assignedMarketerId;

  if (assignedMarketerId === undefined) {
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { assignedMarketerId: true }
    });

    if (!client) {
      throw new AppError(ErrorCodes.NOT_FOUND);
    }

    assignedMarketerId = client.assignedMarketerId;
  }

  const scopes = options?.scopes ?? (await fetchAccessScopes(user));

  if (!canAccessClient(user, clientId, scopes, assignedMarketerId)) {
    throw new AppError(ErrorCodes.FORBIDDEN);
  }
}

export async function requireWorkAccess(
  user: AccessControlUser,
  target: { clientId: string; ownerId: string }
): Promise<void> {
  const scopes = await fetchAccessScopes(user);

  await requireClientAccess(user, target.clientId, { scopes });
  await requireMarketerAccess(user, target.ownerId, scopes);
}

export function buildClientScopeWhere(user: AccessControlUser, scopes: AccessScopeRecord[]) {
  if (user.role === Role.SUPER_ADMIN) {
    return {};
  }

  if (user.role === Role.MARKETER) {
    return { assignedMarketerId: user.id };
  }

  if (scopes.some((scope) => scope.adminId === user.id && scope.allClients)) {
    return {};
  }

  const clientIds = scopes
    .filter((scope) => scope.adminId === user.id)
    .map((scope) => scope.clientId)
    .filter((clientId): clientId is string => Boolean(clientId));
  const marketerIds = scopes
    .filter((scope) => scope.adminId === user.id)
    .map((scope) => scope.marketerId)
    .filter((marketerId): marketerId is string => Boolean(marketerId));
  const hasAllMarketers = scopes.some((scope) => scope.adminId === user.id && scope.allMarketers);

  const clauses = [];

  if (clientIds.length > 0) {
    clauses.push({ id: { in: [...new Set(clientIds)] } });
  }

  if (hasAllMarketers) {
    clauses.push({ assignedMarketerId: { not: null } });
  } else if (marketerIds.length > 0) {
    clauses.push({ assignedMarketerId: { in: [...new Set(marketerIds)] } });
  }

  return clauses.length > 0 ? { OR: clauses } : { id: { in: [] } };
}
