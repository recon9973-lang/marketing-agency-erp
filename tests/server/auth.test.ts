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
