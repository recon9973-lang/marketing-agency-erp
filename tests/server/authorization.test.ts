import { describe, expect, it } from "vitest";
import { Role } from "@/domain/types";
import {
  requireCurrentUser,
  requireRole,
  requireClientAccess,
  requireMarketerAccess,
  scopesForAdmin,
} from "@/server/authorization";
import { AppError, ErrorCode } from "@/server/errors";

const superAdmin = { id: "sa-1", role: Role.SUPER_ADMIN };
const admin = { id: "admin-1", role: Role.ADMIN };
const marketer = { id: "marketer-1", role: Role.MARKETER };

describe("requireCurrentUser", () => {
  it("returns the user when present", () => {
    expect(requireCurrentUser(marketer)).toBe(marketer);
  });
  it("throws FORBIDDEN when null", () => {
    expect(() => requireCurrentUser(null)).toThrowError(AppError);
    try {
      requireCurrentUser(undefined);
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.FORBIDDEN);
    }
  });
});

describe("requireRole", () => {
  it("passes when role is allowed", () => {
    expect(() => requireRole(admin, [Role.ADMIN, Role.SUPER_ADMIN])).not.toThrow();
  });
  it("throws FORBIDDEN when role is not allowed", () => {
    expect(() => requireRole(marketer, [Role.SUPER_ADMIN])).toThrowError(AppError);
  });
});

describe("requireClientAccess", () => {
  it("allows super admin to any client", () => {
    expect(() => requireClientAccess(superAdmin, "client-9", [])).not.toThrow();
  });
  it("allows a marketer only for their assigned client", () => {
    expect(() => requireClientAccess(marketer, "client-1", [], "marketer-1")).not.toThrow();
    expect(() => requireClientAccess(marketer, "client-2", [], "marketer-2")).toThrowError(AppError);
  });
  it("allows an admin within their marketer scope", () => {
    const scopes = [
      { adminId: "admin-1", marketerId: "marketer-1", clientId: null, allMarketers: false, allClients: false },
    ];
    expect(() => requireClientAccess(admin, "client-1", scopes, "marketer-1")).not.toThrow();
    expect(() => requireClientAccess(admin, "client-3", scopes, "marketer-9")).toThrowError(AppError);
  });
});

describe("requireMarketerAccess", () => {
  it("blocks a marketer from another marketer", () => {
    expect(() => requireMarketerAccess(marketer, "marketer-2", [])).toThrowError(AppError);
    expect(() => requireMarketerAccess(marketer, "marketer-1", [])).not.toThrow();
  });
});

describe("scopesForAdmin", () => {
  it("returns only the given admin's scopes", () => {
    const scopes = [
      { adminId: "admin-1", marketerId: null, clientId: null, allMarketers: true, allClients: false },
      { adminId: "admin-2", marketerId: null, clientId: null, allMarketers: false, allClients: true },
    ];
    expect(scopesForAdmin("admin-1", scopes)).toHaveLength(1);
    expect(scopesForAdmin("admin-1", scopes)[0].adminId).toBe("admin-1");
  });
});
