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
import nodemailer from "nodemailer";

import { db } from "@/server/db";
import { UserStatus } from "@/domain/types";
import { recordLogin } from "@/server/tracking";

const authSecret =
  process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "dev-auth-secret");

const BRAND = "#1f7a68";

/**
 * 매직링크 메일 커스텀 발송.
 * 받는 사람 상태로 문구 분기: INVITED(초대·첫로그인 전) → "VENOM님이 초대했습니다", ACTIVE → 로그인 링크.
 */
async function sendVerificationRequest(params: {
  identifier: string;
  url: string;
  provider: { server?: unknown; from?: string };
}) {
  const { identifier, url, provider } = params;
  const staff = await db.user.findFirst({
    where: { email: identifier.trim().toLowerCase() },
    select: { status: true }
  });
  const isInvite = staff?.status === UserStatus.INVITED;

  const subject = isInvite ? "VENOM님이 초대했습니다" : "VENOM ERP 로그인 링크";
  const heading = isInvite ? "VENOM님이 초대했습니다" : "VENOM ERP 로그인";
  const lead = isInvite
    ? "베놈 마케팅 ERP에 초대되었습니다. 아래 버튼을 눌러 로그인하세요."
    : "아래 버튼을 눌러 로그인하세요.";
  const cta = isInvite ? "초대 수락하고 로그인" : "로그인";

  const html = `<!doctype html><html><body style="margin:0;background:#f6f8f7;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Segoe UI',sans-serif;color:#12211d">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:440px;max-width:92%;background:#ffffff;border:1px solid #dbe4e0;border-radius:4px">
      <tr><td style="padding:28px 32px 6px">
        <div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:${BRAND}">VENOM · MARKETING ERP</div>
        <h1 style="margin:12px 0 8px;font-size:22px;line-height:1.3">${heading}</h1>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#5b6b66">${lead}</p>
      </td></tr>
      <tr><td style="padding:18px 32px 28px">
        <a href="${url}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:4px">${cta} &rarr;</a>
        <p style="margin:20px 0 0;font-size:12px;line-height:1.7;color:#8a9a95">버튼이 안 열리면 아래 주소를 복사해 브라우저에 붙여넣으세요:<br><span style="color:${BRAND};word-break:break-all">${url}</span></p>
        <p style="margin:16px 0 0;font-size:12px;color:#8a9a95">본인이 요청하지 않았다면 이 메일을 무시하세요. 링크는 24시간 후 만료됩니다.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  const text = `${heading}\n\n${lead}\n\n${cta}: ${url}\n\n본인이 요청하지 않았다면 무시하세요. (24시간 후 만료)`;

  const transport = nodemailer.createTransport(
    provider.server as Parameters<typeof nodemailer.createTransport>[0]
  );
  await transport.sendMail({ to: identifier, from: provider.from, subject, text, html });
}

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
          from: process.env.EMAIL_FROM,
          sendVerificationRequest
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
