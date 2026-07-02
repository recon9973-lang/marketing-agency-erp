import type { AdapterUser } from "next-auth/adapters";
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { Role } from "@/domain/types";

type CallbackUserLike = Pick<User | AdapterUser, "id" | "role">;

type CallbackAccountLike = {
  type?: string | null;
  provider?: string | null;
  providerAccountId?: string | null;
};

type SessionUserLike = Session["user"];

type JwtLike = JWT & {
  authProvider?: string;
  authProviderAccountId?: string;
};

function parseRole(role: unknown): Role | undefined {
  if (role === Role.SUPER_ADMIN || role === Role.ADMIN || role === Role.MARKETER) {
    return role;
  }

  return undefined;
}

export function mergeJwtToken({
  token,
  user,
  account
}: {
  token: JwtLike;
  user?: CallbackUserLike;
  account?: CallbackAccountLike | null;
}): JwtLike {
  const nextToken: JwtLike = { ...token };
  const role = parseRole(user?.role) ?? parseRole(token.role);

  if (role) {
    nextToken.role = role;
  } else {
    delete nextToken.role;
  }

  // credentials(데모) 로그인은 Account 행이 없으므로 provider 식별자를 저장하지 않는다.
  // 저장하면 staff 해석이 존재하지 않는 계정 연결을 찾다가 실패한다.
  const isOAuthAccount = account?.type !== "credentials";

  if (account?.provider && isOAuthAccount) {
    nextToken.authProvider = account.provider;
  }

  if (account?.providerAccountId && isOAuthAccount) {
    nextToken.authProviderAccountId = account.providerAccountId;
  }

  return nextToken;
}

export function buildSessionUser({
  user,
  token
}: {
  user?: CallbackUserLike;
  token: JwtLike;
}): Pick<NonNullable<SessionUserLike>, "id" | "role" | "authProvider" | "authProviderAccountId"> {
  const role = parseRole(token.role);

  return {
    id: user?.id ?? token.sub ?? "",
    role,
    authProvider: typeof token.authProvider === "string" ? token.authProvider : undefined,
    authProviderAccountId: typeof token.authProviderAccountId === "string" ? token.authProviderAccountId : undefined
  };
}
