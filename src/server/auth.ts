// 인증: (1) 관리자 이메일+비밀번호 로그인(SMTP 불필요) + (2) 직원 이메일 매직링크(선택).
// next-auth v5(beta) + @auth/prisma-adapter, JWT 세션 전략(비밀번호 로그인 요건).
//
// 필요 env:
//   AUTH_SECRET (필수)
//   DATABASE_URL / DATABASE_URL_UNPOOLED
//   ADMIN_EMAIL, ADMIN_PASSWORD  → 이메일+비밀번호로 최고관리자 로그인(계정 자동 생성)
//   EMAIL_SERVER(SMTP), EMAIL_FROM → (선택) 직원 매직링크도 쓰려면 설정
//
// ⚠️ 직원 전용: 사전 등록/초대된 이메일만 로그인 허용(signIn 콜백 화이트리스트).
//    단, ADMIN_EMAIL은 비밀번호 로그인 시 최고관리자로 자동 등록된다.
import NextAuth from "next-auth";
import Email from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import nodemailer from "nodemailer";
import { createHash, timingSafeEqual } from "node:crypto";

import { db } from "@/server/db";
import { Role, UserStatus } from "@/domain/types";
import { recordLogin } from "@/server/tracking";
import { verifyPassword } from "@/server/security/password";

/** 길이 노출/불일치 예외 없이 상수시간 비교(둘 다 SHA-256으로 고정길이화). */
function secureEquals(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * 입력·환경변수 정규화 — 맥↔PC 로그인 불일치의 실제 원인들을 코드에서 흡수.
 * (1) trim: 자동완성·IME·env 개행이 붙이는 양끝 공백 제거(내부 공백은 보존).
 * (2) NFKC: 유니코드 호환 정규화. 세 가지 맥↔PC 차이를 한 번에 통일한다 —
 *     ① 한글 조합 방식(macOS 분리형 NFD ↔ Windows 조합형),
 *     ② 전각(full-width) ASCII(ａｂｃ１２３) ↔ 반각(abc123) — PC 한글 IME가
 *        영문/숫자를 전각으로 입력하는 경우,
 *     ③ 기타 호환문자. 양쪽을 같은 규칙으로 정규화하므로 비교가 일치한다.
 *   ※ NFKC로도 안 통일되는 건 아예 다른 문자(예: 원화 ₩ U+20A9 ↔ 백슬래시 \)라,
 *     그 경우는 비밀번호에서 \ 를 빼는 것이 근본 해결이다.
 */
function normalizeCredential(v: string): string {
  // ₩(한국 윈도우 백슬래시 키)·스마트 따옴표는 NFKC로 안 합쳐지므로 명시적으로 통일.
  return v
    .normalize("NFKC")
    .replace(/₩/g, "\\")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim();
}

/** 진단용 — 입력 문자의 "종류"만 분류(실제 값은 노출하지 않음). 맥↔PC 원인 파악. */
function classifyChars(s: string): string {
  const flags: string[] = [];
  const codes = Array.from(s).map((c) => c.codePointAt(0) ?? 0);
  if (codes.some((c) => c >= 0xff01 && c <= 0xff5e)) flags.push("fullwidth"); // 전각 ASCII(PC 한글IME)
  if (codes.some((c) => c === 0x20a9)) flags.push("won"); // 원화 기호 ₩(백슬래시 자리)
  if (/\s/.test(s)) flags.push("space"); // 내부 공백
  if (codes.some((c) => c < 0x20 || c > 0x7e)) flags.push("nonascii"); // 출력가능 ASCII 밖
  return flags.join(",") || "ascii";
}

// 부트스트랩(테스트) 관리자 — Vercel env 설정과 무관하게 항상 로그인 가능한 고정 계정.
// 잠금 방지용. 비밀번호는 scrypt 해시로만 보관(원문은 코드에 없음).
// ⚠️ 실제 운영 전환 시 이 계정은 제거하거나 비밀번호를 교체할 것.
const BOOTSTRAP_EMAIL = "admin@venom.app";
const BOOTSTRAP_HASH =
  "scrypt$6d2561332f18d574604d1c9447dc0c3a$fad8ab94953d4c59ba91f1167078a0885904b819d4c00228415c54cbabbbb8bb4fed3603fa23988fd636f40ba1285b92d3a6b5e6b933b1c677667223ad059515";

/** 운영 전환 스위치 — DISABLE_BOOTSTRAP_ADMIN 이 truthy면 공용 부트스트랩 계정을 완전 차단. */
export function isBootstrapDisabled(): boolean {
  return /^(1|true|yes|on)$/i.test(process.env.DISABLE_BOOTSTRAP_ADMIN ?? "");
}

async function upsertAdminUser(email: string) {
  const user = await db.user.upsert({
    where: { email },
    update: { status: UserStatus.ACTIVE, isActive: true, role: Role.SUPER_ADMIN, canAccessSettings: true },
    create: {
      email,
      name: "최고관리자",
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      isActive: true,
      canAccessSettings: true
    },
    select: { id: true, email: true, name: true }
  });
  return { id: user.id, email: user.email, name: user.name };
}

/**
 * 이메일+비밀번호 관리자 로그인.
 * (1) 부트스트랩 고정 계정(env 무관) 또는 (2) env(ADMIN_EMAIL/ADMIN_PASSWORD) 일치 시
 * 해당 이메일을 최고관리자(ACTIVE)로 upsert 하고 로그인시킨다.
 */
async function authorizeAdmin(rawEmail: unknown, rawPassword: unknown) {
  const email = normalizeCredential(String(rawEmail ?? "")).toLowerCase();
  // 비밀번호도 정규화(NFKC+trim) — 맥↔PC 한글 조합 방식 차이·끝 공백으로 인한 불일치 방지.
  const password = normalizeCredential(String(rawPassword ?? ""));
  if (!email || !password) return null;

  // (1) 부트스트랩 계정 — env와 무관하게 항상 허용(초기 설치·잠금 방지용).
  //     ⚠️ 운영 전환 시 DISABLE_BOOTSTRAP_ADMIN=true 로 공용 백도어를 차단한다.
  if (!isBootstrapDisabled() && secureEquals(email, BOOTSTRAP_EMAIL) && verifyPassword(password, BOOTSTRAP_HASH)) {
    return upsertAdminUser(BOOTSTRAP_EMAIL);
  }

  // (2) env 기반 관리자.
  const adminEmail = normalizeCredential(process.env.ADMIN_EMAIL ?? "").toLowerCase();
  if (!adminEmail) return null;
  if (!secureEquals(email, adminEmail)) return null;

  // 비밀번호 검증: 설정된 DB 해시(우선) 또는 env ADMIN_PASSWORD(복구용) 중 하나라도 맞으면 통과.
  // 컬럼 미반영(배포 직후 마이그레이션 지연) 등으로 조회가 실패해도 env 검증으로 폴백 — 잠금 방지.
  let existing: { passwordHash: string | null } | null = null;
  try {
    existing = await db.user.findUnique({ where: { email: adminEmail }, select: { passwordHash: true } });
  } catch {
    existing = null;
  }
  const envPassword = normalizeCredential(process.env.ADMIN_PASSWORD ?? "");
  const hashOk = verifyPassword(password, existing?.passwordHash);
  const envOk = envPassword.length > 0 && secureEquals(password, envPassword);
  if (!hashOk && !envOk) {
    // 실제 값은 절대 로그하지 않는다 — 원인 파악용 분류만(전각/공백 등).
    console.warn(
      `[auth] admin login fail: hasHash=${Boolean(existing?.passwordHash)}` +
        ` rawClass=${classifyChars(String(rawPassword ?? ""))}` +
        ` normClass=${classifyChars(password)}`
    );
    return null;
  }

  return upsertAdminUser(adminEmail);
}

/**
 * 개인 로그인 링크 인증 — 이메일(SMTP) 없이 직원을 로그인시킨다.
 * User.loginLinkToken과 일치하고 로그인 허용 상태(ACTIVE/INVITED)면 통과.
 * 관리자가 링크를 카톡/문자로 전달 → 받은 사람이 클릭하면 자동 로그인된다.
 * (INVITED는 signIn 이벤트에서 ACTIVE로 전환됨)
 */
async function authorizeLoginToken(rawToken: unknown) {
  const token = String(rawToken ?? "").trim();
  if (token.length < 16) return null;
  const user = await db.user.findFirst({
    where: { loginLinkToken: token, status: { in: [UserStatus.ACTIVE, UserStatus.INVITED] } },
    select: { id: true, email: true, name: true }
  });
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

const authSecret =
  process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "dev-auth-secret");

const BRAND = "#d9662e"; // 톤다운 테라코타 오렌지 (VENOM ERP V2.1 브랜드)

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

  const html = `<!doctype html><html><body style="margin:0;background:#f7f6f4;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Segoe UI',sans-serif;color:#18202f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:440px;max-width:92%;background:#ffffff;border:1px solid #e8e7e4;border-radius:4px">
      <tr><td style="padding:28px 32px 6px">
        <div style="font-weight:900;font-size:23px;letter-spacing:-.01em;line-height:1;color:#18202f">VENOM<span style="color:${BRAND}">&bull;</span></div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.14em;color:#9a9a96;margin-top:7px">MARKETING ERP</div>
        <h1 style="margin:16px 0 8px;font-size:22px;line-height:1.3">${heading}</h1>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#6b6b66">${lead}</p>
      </td></tr>
      <tr><td style="padding:18px 32px 28px">
        <a href="${url}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:4px">${cta} &rarr;</a>
        <p style="margin:20px 0 0;font-size:12px;line-height:1.7;color:#9a9a96">버튼이 안 열리면 아래 주소를 복사해 브라우저에 붙여넣으세요:<br><span style="color:${BRAND};word-break:break-all">${url}</span></p>
        <p style="margin:16px 0 0;font-size:12px;color:#9a9a96">본인이 요청하지 않았다면 이 메일을 무시하세요. 링크는 24시간 후 만료됩니다.</p>
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
  // 비밀번호(Credentials) 로그인은 JWT 세션이 필요하다. 매직링크도 JWT와 호환.
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      id: "admin-password",
      name: "관리자 로그인",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" }
      },
      authorize: async (credentials) => authorizeAdmin(credentials?.email, credentials?.password)
    }),
    Credentials({
      id: "login-link",
      name: "로그인 링크",
      credentials: { token: { label: "토큰", type: "text" } },
      authorize: async (credentials) => authorizeLoginToken(credentials?.token)
    }),
    ...(emailConfigured
      ? [
          Email({
            server: process.env.EMAIL_SERVER,
            from: process.env.EMAIL_FROM,
            sendVerificationRequest
            // maxAge: 기본 24h 매직링크 유효
          })
        ]
      : [])
  ],
  pages: { signIn: "/login" },
  callbacks: {
    /**
     * 직원만 로그인 허용: 사전 등록된 ACTIVE/INVITED 사용자만 통과.
     * (관리자 비밀번호 로그인은 authorize에서 이미 ACTIVE로 upsert되어 통과)
     */
    async signIn({ user }) {
      const email = user?.email?.trim().toLowerCase();
      if (!email) return false;
      const staff = await db.user.findFirst({
        where: { email, status: { in: [UserStatus.ACTIVE, UserStatus.INVITED] } },
        select: { id: true, status: true }
      });
      if (!staff) return false; // 미등록 이메일 차단
      return true;
    },
    /** JWT에 이메일/이름 유지 (getCurrentUser가 세션 이메일로 DB 조회). */
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      if (user?.name) token.name = user.name;
      return token;
    },
    /** 세션에 이메일 노출 → resolveStaffUser가 DB 사용자 확정. */
    async session({ session, token }) {
      if (session.user) {
        if (token?.email) session.user.email = token.email as string;
        if (token?.name) session.user.name = token.name as string;
      }
      return session;
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
