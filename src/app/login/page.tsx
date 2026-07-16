import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { signIn } from "@/server/auth";
import { BrandLogo } from "@/components/erp/BrandLogo";
import { AdminLoginForm } from "./AdminLoginForm";
import { SignupRequestForm } from "@/components/auth/SignupRequestForm";

// Sensitive 환경변수(ADMIN_*, EMAIL_SERVER)는 빌드 시점엔 안 보이고 런타임에만 주입된다.
// 요청마다(런타임) 읽도록 강제한다.
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "이메일 또는 비밀번호가 올바르지 않습니다.",
  AccessDenied: "등록되지 않았거나 로그인 권한이 없는 이메일입니다. 관리자에게 계정 등록을 요청해 주세요.",
  Verification: "로그인 링크가 만료되었거나 이미 사용되었습니다. 다시 시도해 주세요.",
  default: "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요."
};

async function passwordLogin(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    redirect("/login?error=CredentialsSignin");
  }
  try {
    await signIn("admin-password", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=${error.type ?? "CredentialsSignin"}`);
    }
    throw error; // 성공 리다이렉트(NEXT_REDIRECT)는 흘려보냄
  }
}

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    redirect("/login?error=default");
  }
  try {
    await signIn("nodemailer", { email, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=${error.type ?? "default"}`);
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default : null;

  const adminLoginConfigured = Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
  const emailConfigured = Boolean(process.env.EMAIL_SERVER);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08080a] px-6 py-10">
      {/* 상단 오렌지 글로우 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(680px circle at 50% -8%, rgba(217,102,46,0.18), transparent 62%)" }}
      />
      {/* 테크 그리드 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.10) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage: "radial-gradient(circle at 50% 36%, black, transparent 72%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 36%, black, transparent 72%)"
        }}
      />

      <section className="relative w-full max-w-[400px]">
        {/* 카드 외곽 오렌지 링 글로우 */}
        <div aria-hidden className="absolute -inset-px rounded-2xl bg-gradient-to-b from-brand/40 via-white/5 to-transparent opacity-60 blur-[1px]" />
        <div className="relative rounded-2xl border border-white/10 bg-[#121116]/90 p-8 shadow-2xl backdrop-blur-xl">
          {/* 상태 태그 */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">Secure Access</span>
          </div>

          <BrandLogo tone="dark" className="text-2xl" />
          <p className="mt-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
            Marketing ERP
          </p>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">관리자 로그인</h1>
          <p className="mt-2 text-sm leading-6 text-white/45">
            등록된 관리자 계정으로 로그인하세요.
          </p>

          {errorMessage ? (
            <div
              role="alert"
              className="mt-6 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-300"
            >
              {errorMessage}
            </div>
          ) : null}

          {adminLoginConfigured ? (
            <AdminLoginForm action={passwordLogin} />
          ) : (
            <div className="mt-6 rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-200/90">
              <p className="font-semibold">로그인 환경 변수가 아직 비어 있습니다.</p>
              <p className="mt-1 text-amber-200/70">
                Vercel에 <b>AUTH_SECRET</b>, <b>ADMIN_EMAIL</b>, <b>ADMIN_PASSWORD</b>를 설정하고 재배포하면 켜집니다.
              </p>
            </div>
          )}

          {emailConfigured ? (
            <form action={sendMagicLink} className="mt-6 border-t border-white/10 pt-5">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-white/35">직원 매직링크 (선택)</p>
              <div className="flex gap-2">
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="직원 이메일"
                  className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 text-sm text-white placeholder-white/30 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg border border-white/15 px-4 text-sm font-semibold text-white/80 transition hover:bg-white/5"
                >
                  링크
                </button>
              </div>
            </form>
          ) : null}

          <SignupRequestForm />

          <div className="mt-7 flex items-center gap-2 border-t border-white/5 pt-5 text-white/30">
            <ShieldCheck className="h-3.5 w-3.5" />
            <p className="text-[11px] leading-5">등록된 관리자·직원만 접근할 수 있습니다.</p>
          </div>
        </div>

        <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-white/20">
          VENOM · Marketing Operations
        </p>
      </section>
    </main>
  );
}
