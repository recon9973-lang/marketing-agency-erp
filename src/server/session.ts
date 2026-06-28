import NextAuth from "next-auth";
import Kakao from "next-auth/providers/kakao";
import { Role } from "@/domain/types";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type SessionUserLike = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: unknown;
};

const kakaoConfigured = Boolean(process.env.AUTH_KAKAO_ID && process.env.AUTH_KAKAO_SECRET);
const authSecret =
  process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "dev-auth-secret");

const authClient = authSecret
  ? NextAuth({
      secret: authSecret,
      trustHost: true,
      session: {
        strategy: "jwt"
      },
      providers: kakaoConfigured
        ? [
            Kakao({
              clientId: process.env.AUTH_KAKAO_ID!,
              clientSecret: process.env.AUTH_KAKAO_SECRET!
            })
          ]
        : [],
      callbacks: {
        jwt({ token, user }) {
          const role = parseRole((user as SessionUserLike | undefined)?.role ?? token.role) ?? Role.MARKETER;
          token.role = role;
          return token;
        },
        session({ session, token }) {
          const role = parseRole(token.role) ?? Role.MARKETER;
          session.user = {
            ...session.user,
            id: token.sub ?? "",
            role
          };
          return session;
        }
      }
    })
  : null;

function parseRole(role: unknown): Role | null {
  if (role === Role.SUPER_ADMIN || role === Role.ADMIN || role === Role.MARKETER) {
    return role;
  }

  return null;
}

function mapSessionUser(user?: SessionUserLike | null): CurrentUser | null {
  const role = parseRole(user?.role);
  const id = user?.id?.trim();
  const email = user?.email?.trim();

  if (!role || !id || !email) {
    return null;
  }

  return {
    id,
    name: user?.name?.trim() || email,
    email,
    role
  };
}

function getDevUser(): CurrentUser | null {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_SESSION !== "true") {
    return null;
  }

  const role = parseRole(process.env.DEV_SESSION_ROLE) ?? Role.ADMIN;

  return {
    id: "dev-user",
    name: "Local Preview",
    email: "dev@marketing-erp.local",
    role
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const session = await authClient?.auth();
    const user = mapSessionUser(session?.user as SessionUserLike | undefined);
    return user ?? getDevUser();
  } catch {
    return getDevUser();
  }
}
