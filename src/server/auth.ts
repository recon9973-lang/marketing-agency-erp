import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Kakao from "next-auth/providers/kakao";
import { UserStatus } from "@prisma/client";
import { buildSessionUser, mergeJwtToken } from "@/server/auth-helpers";
import { db } from "@/server/db";

const kakaoConfigured = Boolean(process.env.AUTH_KAKAO_ID && process.env.AUTH_KAKAO_SECRET);
// 데모 로그인: 비밀번호 없이 시드된 직원 계정으로 바로 로그인한다.
// 공개 데모 전용 스위치이므로 실제 운영 배포에서는 반드시 꺼야 한다.
const demoLoginEnabled = process.env.AUTH_DEMO_LOGIN === "true";
const authSecret =
  process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "dev-auth-secret");

const providers: NextAuthConfig["providers"] = [];

if (kakaoConfigured) {
  providers.push(
    Kakao({
      clientId: process.env.AUTH_KAKAO_ID!,
      clientSecret: process.env.AUTH_KAKAO_SECRET!
    })
  );
}

if (demoLoginEnabled) {
  providers.push(
    Credentials({
      id: "demo",
      name: "Demo Login",
      credentials: {
        email: { type: "text" }
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";

        if (!email) {
          return null;
        }

        const user = await db.user.findFirst({
          where: { email, isActive: true, status: UserStatus.ACTIVE },
          select: { id: true, name: true, email: true, role: true }
        });

        if (!user) {
          return null;
        }

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      }
    })
  );
}

export const authConfig = {
  adapter: PrismaAdapter(db),
  secret: authSecret,
  trustHost: true,
  session: {
    strategy: "jwt"
  },
  providers,
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
