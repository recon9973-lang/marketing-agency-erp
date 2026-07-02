import type { AccessScopeRecord } from "@/domain/access-control";
import { Role } from "@/domain/types";
import type { CurrentUser } from "@/server/session";

export function makeSuperAdmin(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "super-admin-1",
    name: "Super Admin",
    email: "super@agency.test",
    role: Role.SUPER_ADMIN,
    ...overrides
  };
}

export function makeAdmin(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "admin-1",
    name: "Admin",
    email: "admin@agency.test",
    role: Role.ADMIN,
    ...overrides
  };
}

export function makeMarketer(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "marketer-1",
    name: "Marketer",
    email: "marketer@agency.test",
    role: Role.MARKETER,
    ...overrides
  };
}

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
