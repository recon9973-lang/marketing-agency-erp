import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { UserStatus } from "@/domain/types";
import { db } from "@/server/db";
import { recordLogin } from "@/server/tracking";

// 이메일 매직링크(직원 전용) 인증. SMTP(EMAIL_SERVER/EMAIL_FROM)가 설정된 경우에만
// provider를 활성화한다 — 미설정 환경에서도 앱은 기동되며, 로컬은 개발용 세션(dev-role)으로 접근.
const emailConfigured = Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM);
const authSecret =
  process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "dev-auth-secret");

export const authConfig = {
  adapter: PrismaAdapter(db),
  secret: authSecret,
  trustHost: true,
  session: {
    strategy: "database"
  },
  pages: {
    signIn: "/login"
  },
  providers: emailConfigured
    ? [
        Nodemailer({
          server: process.env.EMAIL_SERVER,
          from: process.env.EMAIL_FROM
          // maxAge: 기본 24h 매직링크 유효
        })
      ]
    : [],
  callbacks: {
    /**
     * 직원만 로그인 허용: 사전 등록된 ACTIVE/INVITED 사용자만 통과.
     * (초대는 관리자가 User를 INVITED로 생성 → 첫 로그인 시 ACTIVE 전환)
     */
    async signIn({ user }) {
      const email = user?.email?.trim().toLowerCase();
      if (!email) return false;
      const staff = await db.user.findFirst({
        where: { email, status: { in: [UserStatus.ACTIVE, UserStatus.INVITED] } },
        select: { id: true, status: true }
      });
      if (!staff) return false; // 미등록 이메일 차단
      if (staff.status === UserStatus.INVITED) {
        await db.user.update({ where: { id: staff.id }, data: { status: UserStatus.ACTIVE } });
      }
      return true;
    }
  },
  events: {
    async signIn({ user }) {
      if (user?.id) {
        try {
          await recordLogin({ userId: user.id, success: true });
        } catch {
          /* 로그인 이력 실패는 로그인 자체를 막지 않음 */
        }
      }
    }
  }
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
