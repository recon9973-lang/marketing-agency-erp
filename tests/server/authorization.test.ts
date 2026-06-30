import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/domain/types";
import { ErrorCode } from "@/server/errors";
import { adminUser, marketerUser, superAdminUser } from "../helpers/users";
import { clientScope, marketerScope } from "../helpers/scopes";

const getCurrentUserMock = vi.fn();

vi.mock("@/server/session", () => ({
  getCurrentUser: getCurrentUserMock
}));

async function loadAuthorization() {
  return import("@/server/authorization");
}

describe("requireRole", () => {
  it("allows a user whose role is in the allowed set", async () => {
    const { requireRole } = await loadAuthorization();
    expect(() => requireRole(superAdminUser(), [Role.SUPER_ADMIN])).not.toThrow();
    expect(() => requireRole(adminUser(), [Role.SUPER_ADMIN, Role.ADMIN])).not.toThrow();
  });

  it("rejects a user whose role is not allowed", async () => {
    const { requireRole } = await loadAuthorization();
    expect(() => requireRole(marketerUser(), [Role.SUPER_ADMIN, Role.ADMIN])).toThrowError(
      expect.objectContaining({ code: ErrorCode.FORBIDDEN })
    );
  });
});

describe("requireClientAccess", () => {
  it("lets super admins access any client", async () => {
    const { requireClientAccess } = await loadAuthorization();
    await expect(requireClientAccess(superAdminUser(), "client-x", { scopes: [] })).resolves.toBeUndefined();
  });

  it("limits admins to their scoped clients", async () => {
    const { requireClientAccess } = await loadAuthorization();
    const user = adminUser();
    const scopes = [clientScope(user.id, "client-1")];

    await expect(requireClientAccess(user, "client-1", { scopes })).resolves.toBeUndefined();
    await expect(requireClientAccess(user, "client-2", { scopes })).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN
    });
  });

  it("allows admins to access clients of scoped marketers", async () => {
    const { requireClientAccess } = await loadAuthorization();
    const user = adminUser();
    const scopes = [marketerScope(user.id, "marketer-1")];

    await expect(
      requireClientAccess(user, "client-3", { scopes, assignedMarketerId: "marketer-1" })
    ).resolves.toBeUndefined();
    await expect(
      requireClientAccess(user, "client-4", { scopes, assignedMarketerId: "marketer-2" })
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it("prevents a marketer from touching another marketer's client", async () => {
    const { requireClientAccess } = await loadAuthorization();
    const user = marketerUser({ id: "marketer-1" });

    await expect(
      requireClientAccess(user, "client-9", { scopes: [], assignedMarketerId: "marketer-1" })
    ).resolves.toBeUndefined();
    await expect(
      requireClientAccess(user, "client-9", { scopes: [], assignedMarketerId: "marketer-2" })
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });
});

describe("requireMarketerAccess", () => {
  it("lets a marketer access only themselves", async () => {
    const { requireMarketerAccess } = await loadAuthorization();
    const user = marketerUser({ id: "marketer-1" });
    await expect(requireMarketerAccess(user, "marketer-1", [])).resolves.toBeUndefined();
    await expect(requireMarketerAccess(user, "marketer-2", [])).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN
    });
  });

  it("limits admins to scoped marketers", async () => {
    const { requireMarketerAccess } = await loadAuthorization();
    const user = adminUser();
    const scopes = [marketerScope(user.id, "marketer-1")];
    await expect(requireMarketerAccess(user, "marketer-1", scopes)).resolves.toBeUndefined();
    await expect(requireMarketerAccess(user, "marketer-2", scopes)).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN
    });
  });
});

describe("requireCurrentUser", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
  });

  it("returns the resolved current user", async () => {
    const { requireCurrentUser } = await loadAuthorization();
    const user = adminUser();
    getCurrentUserMock.mockResolvedValue(user);
    await expect(requireCurrentUser()).resolves.toEqual(user);
  });

  it("throws UNAUTHENTICATED when there is no current user", async () => {
    const { requireCurrentUser } = await loadAuthorization();
    getCurrentUserMock.mockResolvedValue(null);
    await expect(requireCurrentUser()).rejects.toMatchObject({ code: ErrorCode.UNAUTHENTICATED });
  });
});
