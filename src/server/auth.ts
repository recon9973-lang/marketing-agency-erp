import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Kakao from "next-auth/providers/kakao";
import { buildSessionUser, mergeJwtToken } from "@/server/auth-helpers";
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
      return mergeJwtToken({ token, user, account });
    },
    session({ session, user, token }) {
      session.user = {
        ...session.user,
        ...buildSessionUser({ user, token })
      };

      return session;
    }
  }
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
