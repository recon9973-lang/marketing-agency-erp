import { beforeEach, describe, expect, it, vi } from "vitest";

// process.env의 일부 키(NODE_ENV 등)가 @types/node에서 readonly라, 테스트 내 수정은 캐스팅 별칭을 통해 한다.
const mutableEnv = process.env as Record<string, string | undefined>;

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
    delete mutableEnv.ALLOW_DEV_SESSION;
    delete mutableEnv.DEV_SESSION_ROLE;
    delete mutableEnv.NODE_ENV;
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
      role: "ADMIN",
      baseRole: "ADMIN",
      elevatedToSuperAdmin: false
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
      role: "SUPER_ADMIN",
      baseRole: "SUPER_ADMIN",
      elevatedToSuperAdmin: false
    });
  });

  it("elevates an approved admin to an effective SUPER_ADMIN role", async () => {
    // 프로바이더 식별 경로 — 이메일 경로는 unstable_cache라 Next 런타임 밖(테스트)에서 우회한다.
    authMock.mockResolvedValue({ user: { email: null, authProvider: "kakao", authProviderAccountId: "kakao-boss" } });
    findFirstMock.mockResolvedValue({
      id: "user-9",
      name: "Boss Admin",
      email: "boss-admin@agency.test",
      role: "ADMIN",
      elevatedToSuperAdmin: true
    });

    const { getCurrentUser } = await import("@/server/session");
    const user = await getCurrentUser();

    // 실효 역할은 SUPER_ADMIN이지만, 원래 역할(baseRole)은 ADMIN으로 보존된다.
    expect(user).toEqual({
      id: "user-9",
      name: "Boss Admin",
      email: "boss-admin@agency.test",
      role: "SUPER_ADMIN",
      baseRole: "ADMIN",
      elevatedToSuperAdmin: true
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
      role: "ADMIN",
      baseRole: "ADMIN",
      elevatedToSuperAdmin: false
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
    mutableEnv.NODE_ENV ="development";
    mutableEnv.ALLOW_DEV_SESSION ="true";
    mutableEnv.DEV_SESSION_ROLE ="MARKETER";
    authMock.mockResolvedValue(null);

    const { getCurrentUser } = await import("@/server/session");

    await expect(getCurrentUser()).resolves.toEqual({
      id: "dev-user",
      name: "Local Preview",
      email: "dev@marketing-erp.local",
      role: "MARKETER",
      baseRole: "MARKETER",
      elevatedToSuperAdmin: false,
      canAccessSettings: true
    });
  });

  it("allows a development-only requested role override", async () => {
    mutableEnv.NODE_ENV ="development";
    mutableEnv.ALLOW_DEV_SESSION ="true";
    mutableEnv.DEV_SESSION_ROLE ="ADMIN";
    authMock.mockResolvedValue(null);

    const { getCurrentUser } = await import("@/server/session");

    await expect(getCurrentUser("SUPER_ADMIN")).resolves.toEqual(
      expect.objectContaining({
        role: "SUPER_ADMIN"
      })
    );
  });

  it("ignores requested role overrides in production", async () => {
    mutableEnv.NODE_ENV ="production";
    mutableEnv.ALLOW_DEV_SESSION ="true";
    authMock.mockResolvedValue(null);

    const { getCurrentUser } = await import("@/server/session");

    await expect(getCurrentUser("SUPER_ADMIN")).resolves.toBeNull();
  });
});
