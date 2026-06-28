import { describe, expect, it } from "vitest";
import { canAccessClient, canAccessMarketer } from "@/domain/access-control";
import { Role } from "@/domain/types";

const scopes = [
  { adminId: "admin-1", marketerId: "marketer-1", clientId: null, allMarketers: false, allClients: false },
  { adminId: "admin-1", marketerId: null, clientId: "client-1", allMarketers: false, allClients: false }
];

describe("access control", () => {
  it("allows super admins to access all clients and marketers", () => {
    const user = { id: "root", role: Role.SUPER_ADMIN };
    expect(canAccessClient(user, "client-any", [])).toBe(true);
    expect(canAccessMarketer(user, "marketer-any", [])).toBe(true);
  });

  it("limits admins to assigned clients and marketers", () => {
    const user = { id: "admin-1", role: Role.ADMIN };
    expect(canAccessClient(user, "client-1", scopes)).toBe(true);
    expect(canAccessClient(user, "client-2", scopes)).toBe(false);
    expect(canAccessMarketer(user, "marketer-1", scopes)).toBe(true);
    expect(canAccessMarketer(user, "marketer-2", scopes)).toBe(false);
  });

  it("allows marketers to access only themselves", () => {
    const user = { id: "marketer-1", role: Role.MARKETER };
    expect(canAccessMarketer(user, "marketer-1", [])).toBe(true);
    expect(canAccessMarketer(user, "marketer-2", [])).toBe(false);
  });
});
