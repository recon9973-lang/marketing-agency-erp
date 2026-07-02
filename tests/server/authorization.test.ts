import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/domain/types";
import { AppError, ErrorCodes } from "@/server/errors";
import {
  buildClientScopeWhere,
  requireClientAccess,
  requireCurrentUser,
  requireMarketerAccess,
  requireRole
} from "@/server/authorization";
import { makeAdmin, makeMarketer, makeScope, makeSuperAdmin } from "../helpers/fixtures";

const { getCurrentUserMock, accessScopeFindManyMock, clientFindUniqueMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  accessScopeFindManyMock: vi.fn(),
  clientFindUniqueMock: vi.fn()
}));

vi.mock("@/server/session", () => ({
  getCurrentUser: getCurrentUserMock
}));

vi.mock("@/server/db", () => ({
  db: {
    accessScope: { findMany: accessScopeFindManyMock },
    client: { findUnique: clientFindUniqueMock }
  }
}));

function expectAppError(promise: Promise<unknown>, code: string) {
  return promise.then(
    () => {
      throw new Error(`expected AppError(${code}) but the call succeeded`);
    },
    (error) => {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(code);
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  accessScopeFindManyMock.mockResolvedValue([]);
  clientFindUniqueMock.mockResolvedValue(null);
});

describe("requireCurrentUser", () => {
  it("returns the resolved user", async () => {
    const user = makeAdmin();
    getCurrentUserMock.mockResolvedValue(user);

    await expect(requireCurrentUser()).resolves.toEqual(user);
  });

  it("throws UNAUTHORIZED when no user is resolved", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    await expectAppError(requireCurrentUser(), ErrorCodes.UNAUTHORIZED);
  });
});

describe("requireRole", () => {
  it("allows listed roles and rejects others", () => {
    const admin = makeAdmin();

    expect(requireRole(admin, [Role.SUPER_ADMIN, Role.ADMIN])).toEqual(admin);
    expect(() => requireRole(makeMarketer(), [Role.SUPER_ADMIN, Role.ADMIN])).toThrowError(AppError);

    try {
      requireRole(makeMarketer(), [Role.SUPER_ADMIN]);
      throw new Error("unreachable");
    } catch (error) {
      expect((error as AppError).code).toBe(ErrorCodes.FORBIDDEN);
    }
  });
});

describe("requireMarketerAccess", () => {
  it("always allows super admins", async () => {
    await expect(requireMarketerAccess(makeSuperAdmin(), "marketer-9")).resolves.toBeUndefined();
  });

  it("allows marketers only for themselves", async () => {
    const marketer = makeMarketer();

    await expect(requireMarketerAccess(marketer, marketer.id)).resolves.toBeUndefined();
    await expectAppError(requireMarketerAccess(marketer, "marketer-2"), ErrorCodes.FORBIDDEN);
  });

  it("allows admins only within their scopes", async () => {
    accessScopeFindManyMock.mockResolvedValue([makeScope({ marketerId: "marketer-1" })]);
    const admin = makeAdmin();

    await expect(requireMarketerAccess(admin, "marketer-1")).resolves.toBeUndefined();
    await expectAppError(requireMarketerAccess(admin, "marketer-2"), ErrorCodes.FORBIDDEN);
    expect(accessScopeFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { adminId: admin.id } })
    );
  });
});

describe("requireClientAccess", () => {
  it("throws NOT_FOUND when the client does not exist", async () => {
    clientFindUniqueMock.mockResolvedValue(null);

    await expectAppError(requireClientAccess(makeSuperAdmin(), "missing-client"), ErrorCodes.NOT_FOUND);
  });

  it("blocks marketers from other marketers' clients", async () => {
    clientFindUniqueMock.mockResolvedValue({ assignedMarketerId: "marketer-2" });

    await expectAppError(requireClientAccess(makeMarketer(), "client-1"), ErrorCodes.FORBIDDEN);
  });

  it("allows marketers for their own clients", async () => {
    clientFindUniqueMock.mockResolvedValue({ assignedMarketerId: "marketer-1" });

    await expect(requireClientAccess(makeMarketer(), "client-1")).resolves.toBeUndefined();
  });

  it("allows admins only within client or marketer scopes", async () => {
    clientFindUniqueMock.mockResolvedValue({ assignedMarketerId: "marketer-9" });
    accessScopeFindManyMock.mockResolvedValue([makeScope({ clientId: "client-1" })]);
    const admin = makeAdmin();

    await expect(requireClientAccess(admin, "client-1")).resolves.toBeUndefined();
    await expectAppError(requireClientAccess(admin, "client-2"), ErrorCodes.FORBIDDEN);
  });

  it("uses provided assignedMarketerId and scopes without extra queries", async () => {
    await expect(
      requireClientAccess(makeAdmin(), "client-1", {
        assignedMarketerId: "marketer-1",
        scopes: [makeScope({ allMarketers: true })]
      })
    ).resolves.toBeUndefined();
    expect(clientFindUniqueMock).not.toHaveBeenCalled();
    expect(accessScopeFindManyMock).not.toHaveBeenCalled();
  });
});

describe("buildClientScopeWhere", () => {
  it("returns an unrestricted where for super admins", () => {
    expect(buildClientScopeWhere(makeSuperAdmin(), [])).toEqual({});
  });

  it("scopes marketers to their own clients", () => {
    expect(buildClientScopeWhere(makeMarketer(), [])).toEqual({ assignedMarketerId: "marketer-1" });
  });

  it("returns an empty match for admins without scopes", () => {
    expect(buildClientScopeWhere(makeAdmin(), [])).toEqual({ id: { in: [] } });
  });

  it("combines client and marketer scopes for admins", () => {
    expect(
      buildClientScopeWhere(makeAdmin(), [
        makeScope({ clientId: "client-1" }),
        makeScope({ marketerId: "marketer-1" })
      ])
    ).toEqual({ OR: [{ id: { in: ["client-1"] } }, { assignedMarketerId: { in: ["marketer-1"] } }] });
  });
});
