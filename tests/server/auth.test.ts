import { describe, expect, it } from "vitest";
import { buildSessionUser, mergeJwtToken } from "@/server/auth-helpers";

describe("auth callbacks", () => {
  it("keeps role on the token when user is absent in later jwt callbacks", () => {
    const token = mergeJwtToken({
      token: {
        sub: "user-1",
        role: "ADMIN"
      },
      user: undefined,
      account: undefined
    });

    expect(token.role).toBe("ADMIN");
  });

  it("stores provider identity for oauth accounts only", () => {
    const oauthToken = mergeJwtToken({
      token: { sub: "user-1" },
      user: { id: "user-1", role: "ADMIN" },
      account: { type: "oauth", provider: "kakao", providerAccountId: "kakao-123" }
    });

    expect(oauthToken.authProvider).toBe("kakao");
    expect(oauthToken.authProviderAccountId).toBe("kakao-123");

    const demoToken = mergeJwtToken({
      token: { sub: "user-2" },
      user: { id: "user-2", role: "SUPER_ADMIN" },
      account: { type: "credentials", provider: "demo", providerAccountId: "user-2" }
    });

    expect(demoToken.authProvider).toBeUndefined();
    expect(demoToken.authProviderAccountId).toBeUndefined();
    expect(demoToken.role).toBe("SUPER_ADMIN");
  });

  it("builds session user role from token.role when jwt sessions are resumed", () => {
    const sessionUser = buildSessionUser({
      user: undefined,
      token: {
        sub: "user-1",
        role: "SUPER_ADMIN",
        authProvider: "kakao",
        authProviderAccountId: "kakao-123"
      }
    });

    expect(sessionUser).toEqual({
      id: "user-1",
      role: "SUPER_ADMIN",
      authProvider: "kakao",
      authProviderAccountId: "kakao-123"
    });
  });
});
