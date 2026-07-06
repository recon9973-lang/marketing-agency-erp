import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/server/auth";
import { BrandLogo } from "@/components/erp/BrandLogo";
import { LoginForm } from "./LoginForm";

// Sensitive 환경변수(EMAIL_SERVER)는 Vercel 빌드 시점엔 안 보이고 런타임에만 주입된다.
// 모듈 스코프/정적 평가로 굳으면 항상 false가 되므로, 요청마다(런타임) 읽도록 강제한다.
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "등록되지 않았거나 로그인 권한이 없는 이메일입니다. 관리자에게 계정 등록을 요청해 주세요.",
  Verification: "로그인 링크가 만료되었거나 이미 사용되었습니다. 다시 시도해 주세요.",
  default: "로그인 링크 발송에 실패했습니다. 잠시 후 다시 시도해 주세요."
};

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    redirect("/login?error=default");
  }
  try {
    // 성공 시 next-auth가 "메일 확인" 페이지로 리다이렉트(throw)한다.
    await signIn("nodemailer", { email, redirectTo: "/dashboard" });
  } catch (error) {
    // 미등록/권한없음(AccessDenied) 등은 AuthError → 안내와 함께 로그인으로 복귀.
    if (error instanceof AuthError) {
      redirect(`/login?error=${error.type ?? "default"}`);
    }
    // 성공 리다이렉트(NEXT_REDIRECT) 등은 그대로 흘려보낸다.
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
  // 런타임에 읽어야 Sensitive 값이 잡힌다(모듈 스코프에서 읽으면 false로 박제됨).
  const emailConfigured = Boolean(process.env.EMAIL_SERVER);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <section className="w-full max-w-md rounded-md border border-line bg-white p-8 shadow-sm">
        <BrandLogo tone="light" className="text-2xl" />
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
          Marketing ERP
        </p>
        <h1 className="mt-5 text-3xl font-semibold text-ink">관리자 로그인</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          등록된 직원 이메일로 로그인 링크를 보내드립니다. 메일의 링크를 클릭하면 로그인됩니다.
        </p>

        {errorMessage ? (
          <div
            role="alert"
            className="mt-6 rounded-md border border-danger/30 bg-danger/5 p-4 text-sm leading-6 text-danger"
          >
            {errorMessage}
          </div>
        ) : null}

        {emailConfigured ? (
          <LoginForm action={sendMagicLink} />
        ) : (
          <div className="mt-8 space-y-3">
            <button
              type="button"
              disabled
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-slate-200 px-4 text-sm font-semibold text-slate-500"
            >
              이메일 설정 필요
            </button>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p className="font-semibold">이메일 로그인 환경 변수가 아직 비어 있습니다.</p>
              <p className="mt-1">`EMAIL_SERVER`와 `EMAIL_FROM`을 설정하면 매직링크 로그인이 연결됩니다.</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
