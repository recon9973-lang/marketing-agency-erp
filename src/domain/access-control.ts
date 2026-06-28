import { Role } from "./types";

export type CurrentUser = {
  id: string;
  role: Role;
};

export type AccessScopeRecord = {
  adminId: string;
  marketerId: string | null;
  clientId: string | null;
  allMarketers: boolean;
  allClients: boolean;
};

export function canAccessMarketer(
  user: CurrentUser,
  marketerId: string,
  scopes: AccessScopeRecord[]
) {
  if (user.role === Role.SUPER_ADMIN) return true;
  if (user.role === Role.MARKETER) return user.id === marketerId;
  return scopes.some(
    (scope) =>
      scope.adminId === user.id &&
      (scope.allMarketers || scope.marketerId === marketerId)
  );
}

export function canAccessClient(
  user: CurrentUser,
  clientId: string,
  scopes: AccessScopeRecord[],
  assignedMarketerId?: string | null
) {
  if (user.role === Role.SUPER_ADMIN) return true;
  if (user.role === Role.MARKETER) return assignedMarketerId === user.id;
  return scopes.some(
    (scope) =>
      scope.adminId === user.id &&
      (scope.allClients ||
        scope.clientId === clientId ||
        (assignedMarketerId !== null &&
          assignedMarketerId !== undefined &&
          (scope.allMarketers || scope.marketerId === assignedMarketerId)))
  );
}

export function assertCanAccessClient(
  user: CurrentUser,
  clientId: string,
  scopes: AccessScopeRecord[],
  assignedMarketerId?: string | null
) {
  if (!canAccessClient(user, clientId, scopes, assignedMarketerId)) {
    throw new Error("FORBIDDEN_CLIENT_ACCESS");
  }
}
