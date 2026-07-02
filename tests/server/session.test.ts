import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const findFirstMock = vi.fn();

vi.mock("@/server/auth", () => ({
  auth: authMock
}));

vi.mock("@/server/db", () => ({
  db: {
    user: {
      findFirst: findFirstMock
    }
  }
}));

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    delete process.env.ALLOW_DEV_SESSION;
    delete process.env.DEV_SESSION_ROLE;
  });

  it("returns the matching active staff user by email", async () => {
    authMock.mockResolvedValue({
      user: {
        email: "admin@agency.test",
        name: "Agency Admin"
      }
    });
    findFirstMock.mockResolvedValue({
      id: "user-1",
      name: "Agency Admin",
      email: "admin@agency.test",
      role: "ADMIN"
    });

    const { getCurrentUser } = await import("@/server/session");
    const user = await getCurrentUser();

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: "admin@agency.test",
          isActive: true,
          status: "ACTIVE"
        })
      })
    );
    expect(user).toEqual({
      id: "user-1",
      name: "Agency Admin",
      email: "admin@agency.test",
      role: "ADMIN"
    });
  });

  it("returns the matching active staff user by linked account identity", async () => {
    authMock.mockResolvedValue({
      user: {
        email: null,
        authProvider: "kakao",
        authProviderAccountId: "kakao-123"
      }
    });
    findFirstMock.mockResolvedValue({
      id: "user-2",
      name: "Kakao Staff",
      email: "staff@agency.test",
      role: "SUPER_ADMIN"
    });

    const { getCurrentUser } = await import("@/server/session");
    const user = await getCurrentUser();

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accounts: {
            some: {
              provider: "kakao",
              providerAccountId: "kakao-123"
            }
          },
          isActive: true,
          status: "ACTIVE"
        })
      })
    );
    expect(user).toEqual({
      id: "user-2",
      name: "Kakao Staff",
      email: "staff@agency.test",
      role: "SUPER_ADMIN"
    });
  });

  it("prefers provider identity over email when both are present", async () => {
    authMock.mockResolvedValue({
      user: {
        email: "shared@agency.test",
        authProvider: "kakao",
        authProviderAccountId: "kakao-777"
      }
    });
    findFirstMock.mockResolvedValue({
      id: "user-3",
      name: "Linked Staff",
      email: "other@agency.test",
      role: "ADMIN"
    });

    const { getCurrentUser } = await import("@/server/session");
    const user = await getCurrentUser();

    expect(findFirstMock).toHaveBeenCalledWith({
      where: {
        accounts: {
          some: {
            provider: "kakao",
            providerAccountId: "kakao-777"
          }
        },
        isActive: true,
        status: "ACTIVE"
      },
      select: expect.any(Object)
    });
    expect(user).toEqual({
      id: "user-3",
      name: "Linked Staff",
      email: "other@agency.test",
      role: "ADMIN"
    });
  });

  it("returns null for authenticated users without a matching active staff record", async () => {
    authMock.mockResolvedValue({
      user: {
        email: "unknown@agency.test"
      }
    });
    findFirstMock.mockResolvedValue(null);

    const { getCurrentUser } = await import("@/server/session");

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("uses the dev fallback only when explicitly enabled outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.ALLOW_DEV_SESSION = "true";
    process.env.DEV_SESSION_ROLE = "MARKETER";
    authMock.mockResolvedValue(null);

    const { getCurrentUser } = await import("@/server/session");

    await expect(getCurrentUser()).resolves.toEqual({
      id: "dev-user",
      name: "Local Preview",
      email: "dev@marketing-erp.local",
      role: "MARKETER"
    });
  });

  it("allows a development-only requested role override", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.ALLOW_DEV_SESSION = "true";
    process.env.DEV_SESSION_ROLE = "ADMIN";
    authMock.mockResolvedValue(null);

    const { getCurrentUser } = await import("@/server/session");

    await expect(getCurrentUser("SUPER_ADMIN")).resolves.toEqual(
      expect.objectContaining({
        role: "SUPER_ADMIN"
      })
    );
  });

  it("ignores requested role overrides in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.ALLOW_DEV_SESSION = "true";
    authMock.mockResolvedValue(null);

    const { getCurrentUser } = await import("@/server/session");

    await expect(getCurrentUser("SUPER_ADMIN")).resolves.toBeNull();
  });

  it("never falls back to a dev session in production even when ALLOW_DEV_SESSION is true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.ALLOW_DEV_SESSION = "true";
    process.env.DEV_SESSION_ROLE = "SUPER_ADMIN";
    authMock.mockResolvedValue(null);

    const { getCurrentUser } = await import("@/server/session");

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("does not use a dev session when ALLOW_DEV_SESSION is not enabled outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.ALLOW_DEV_SESSION;
    authMock.mockResolvedValue(null);

    const { getCurrentUser } = await import("@/server/session");

    await expect(getCurrentUser("ADMIN")).resolves.toBeNull();
  });
});
