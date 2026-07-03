// 인증: 직원 전용 이메일 매직링크(인증메일) 가입/로그인.
// next-auth v5(beta) + @auth/prisma-adapter, DB 세션 전략.
//
// 필요 env: AUTH_SECRET, DATABASE_URL, EMAIL_SERVER(SMTP), EMAIL_FROM
// 예) EMAIL_SERVER="smtp://user:pass@smtp.example.com:587"  EMAIL_FROM="no-reply@venom.co.kr"
//
// ⚠️ 직원 전용: 사전 등록/초대된 이메일만 로그인 허용(signIn 콜백 화이트리스트 검사).
import NextAuth from "next-auth";
import Email from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { db } from "@/server/db";
import { UserStatus } from "@/domain/types";
import { recordLogin } from "@/server/tracking";

const authSecret =
  process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "dev-auth-secret");

// SMTP 미설정 시 provider 초기화가 던지므로 base(kakaoConfigured) 패턴대로 가드.
const emailConfigured = Boolean(process.env.EMAIL_SERVER);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  secret: authSecret,
  trustHost: true,
  session: { strategy: "database" },
  providers: emailConfigured
    ? [
        Email({
          server: process.env.EMAIL_SERVER,
          from: process.env.EMAIL_FROM
          // maxAge: 기본 24h 매직링크 유효
        })
      ]
    : [],
  pages: { signIn: "/login" },
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
      // INVITED→ACTIVE 전환은 실제 로그인 완료 시점(events.signIn)에서 처리.
      // (초대 메일 발송 단계에서 signIn 콜백이 돌아도 여기서 활성화하지 않도록 분리)
      return true;
    }
  },
  events: {
    async signIn({ user }) {
      if (user?.id) {
        try {
          // 초대(INVITED) 직원의 첫 로그인 → ACTIVE 전환.
          await db.user.updateMany({
            where: { id: user.id, status: UserStatus.INVITED },
            data: { status: UserStatus.ACTIVE }
          });
        } catch {
          /* 상태 전환 실패는 로그인 자체를 막지 않음 */
        }
        try {
          await recordLogin({ userId: user.id, success: true });
        } catch {
          /* 로그인 이력 실패는 로그인 자체를 막지 않음 */
        }
      }
    }
  }
});
