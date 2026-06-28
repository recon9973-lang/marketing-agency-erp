import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Kakao from "next-auth/providers/kakao";
import { db } from "@/server/db";

const kakaoConfigured = Boolean(process.env.AUTH_KAKAO_ID && process.env.AUTH_KAKAO_SECRET);
const authSecret =
  process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "dev-auth-secret");

export const authConfig = {
  adapter: PrismaAdapter(db),
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
    jwt({ token, user, account }) {
      if (typeof user?.role === "string") {
        token.role = user.role;
      }

      if (account?.provider) {
        token.authProvider = account.provider;
      }

      if (account?.providerAccountId) {
        token.authProviderAccountId = account.providerAccountId;
      }

      return token;
    },
    session({ session, user, token }) {
      session.user = {
        ...session.user,
        id: user?.id ?? token.sub ?? "",
        role: typeof user?.role === "string" ? user.role : undefined,
        authProvider: typeof token.authProvider === "string" ? token.authProvider : undefined,
        authProviderAccountId: typeof token.authProviderAccountId === "string" ? token.authProviderAccountId : undefined
      };

      return session;
    }
  }
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
