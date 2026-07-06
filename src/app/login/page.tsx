import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/server/auth";
import { BrandLogo } from "@/components/erp/BrandLogo";

// Sensitive 환경변수(ADMIN_*, EMAIL_SERVER)는 Vercel 빌드 시점엔 안 보이고 런타임에만 주입된다.
// 모듈 스코프/정적 평가로 굳으면 항상 false가 되므로, 요청마다(런타임) 읽도록 강제한다.
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
    // 성공 시 next-auth가 redirectTo로 리다이렉트(throw)한다.
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

const inputCls =
  "h-12 w-full rounded-md border border-line px-4 text-sm text-ink outline-none focus:border-brand";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default : null;

  // 런타임(요청 시점)에 env를 읽는다 — 빌드 시점 정적 평가 방지(dynamic + 함수 내부 참조).
  const adminLoginConfigured = Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
  const emailConfigured = Boolean(process.env.EMAIL_SERVER);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <section className="w-full max-w-md rounded-md border border-line bg-white p-8 shadow-sm">
        <BrandLogo tone="light" className="text-2xl" />
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
          Marketing ERP
        </p>
        <h1 className="mt-5 text-3xl font-semibold text-ink">관리자 로그인</h1>

        {errorMessage ? (
          <div
            role="alert"
            className="mt-6 rounded-md border border-danger/30 bg-danger/5 p-4 text-sm leading-6 text-danger"
          >
            {errorMessage}
          </div>
        ) : null}

        {adminLoginConfigured ? (
          <form action={passwordLogin} className="mt-8 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">이메일</span>
              <input name="email" type="email" required autoComplete="username" placeholder="you@company.com" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">비밀번호</span>
              <input name="password" type="password" required autoComplete="current-password" placeholder="비밀번호" className={inputCls} />
            </label>
            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white"
            >
              로그인
            </button>
          </form>
        ) : (
          <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <p className="font-semibold">로그인 환경 변수가 아직 비어 있습니다.</p>
            <p className="mt-1">
              Vercel에 <b>AUTH_SECRET</b>, <b>ADMIN_EMAIL</b>, <b>ADMIN_PASSWORD</b> 를 설정하고 재배포하면
              이메일+비밀번호 로그인이 켜집니다.
            </p>
          </div>
        )}

        {emailConfigured ? (
          <form action={sendMagicLink} className="mt-6 space-y-2 border-t border-line pt-6">
            <p className="text-xs font-semibold text-slate-500">직원 매직링크 로그인 (선택)</p>
            <label className="block">
              <input name="email" type="email" required autoComplete="email" placeholder="직원 이메일 (you@company.com)" className={inputCls} />
            </label>
            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink hover:bg-surface"
            >
              로그인 링크 받기
            </button>
          </form>
        ) : null}

        <p className="mt-6 text-xs leading-5 text-slate-500">
          등록된 관리자/직원만 로그인할 수 있습니다.
        </p>
      </section>
    </main>
  );
}
