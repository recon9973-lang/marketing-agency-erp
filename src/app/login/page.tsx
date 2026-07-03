import { signIn } from "@/server/auth";

const emailConfigured = Boolean(process.env.EMAIL_SERVER);

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return;
  }
  // 등록된 직원 이메일에 매직링크 발송 → 링크 클릭 시 signIn 콜백 화이트리스트 검사 후 로그인.
  await signIn("nodemailer", { email, redirectTo: "/dashboard" });
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <section className="w-full max-w-md rounded-md border border-line bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-brand">Marketing Agency ERP</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">관리자 로그인</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          등록된 직원 이메일로 로그인 링크를 보내드립니다. 메일의 링크를 클릭하면 로그인됩니다.
        </p>

        {emailConfigured ? (
          <form action={sendMagicLink} className="mt-8 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">직원 이메일</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="h-12 w-full rounded-md border border-line px-4 text-sm text-ink outline-none focus:border-brand"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white"
            >
              로그인 링크 받기
            </button>
            <p className="text-xs leading-5 text-slate-500">
              사전 등록된 직원 이메일만 로그인할 수 있습니다. 메일이 보이지 않으면 스팸함도 확인해 주세요.
            </p>
          </form>
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
