import { signIn } from "@/server/auth";

const emailConfigured = Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM);
const devSessionEnabled = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_SESSION === "true";

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;
  await signIn("nodemailer", { email, redirectTo: "/dashboard" });
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <section className="w-full max-w-md rounded-md border border-line bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-brand">Marketing Agency ERP</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">관리자 로그인</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          등록된 직원 이메일로 매직링크를 받아 로그인하고 역할별 ERP 화면으로 이동합니다.
        </p>

        {emailConfigured ? (
          <form action={sendMagicLink} className="mt-8 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">직원 이메일</span>
              <input
                name="email"
                type="email"
                required
                placeholder="name@company.com"
                className="h-12 w-full rounded-md border border-line px-4 text-sm text-ink"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-brand px-4 text-sm font-semibold text-white"
            >
              매직링크 보내기
            </button>
            <p className="text-xs leading-5 text-slate-500">
              사전 등록/초대된 직원 이메일만 로그인할 수 있습니다. 메일의 링크를 클릭하면 로그인됩니다.
            </p>
          </form>
        ) : (
          <div className="mt-8 space-y-3">
            <button
              type="button"
              disabled
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-slate-200 px-4 text-sm font-semibold text-slate-500"
            >
              이메일 로그인 설정 필요
            </button>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p className="font-semibold">이메일 매직링크 환경 변수가 아직 비어 있습니다.</p>
              <p className="mt-1">`EMAIL_SERVER`(SMTP)와 `EMAIL_FROM`을 설정하면 실제 로그인을 연결할 수 있습니다.</p>
            </div>
          </div>
        )}

        {devSessionEnabled ? (
          <div className="mt-4 rounded-md border border-brand/20 bg-brand/5 p-4 text-sm leading-6 text-slate-700">
            <p className="font-semibold text-ink">개발용 세션 미리보기가 활성화되어 있습니다.</p>
            <p className="mt-1">인증이 없어도 `/dashboard`로 이동하면 기본 관리자 역할로 ERP 셸을 확인할 수 있습니다.</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
