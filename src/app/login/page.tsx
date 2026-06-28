const kakaoConfigured = Boolean(process.env.AUTH_KAKAO_ID && process.env.AUTH_KAKAO_SECRET);
const devSessionEnabled = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_SESSION === "true";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <section className="w-full max-w-md rounded-md border border-line bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-brand">Marketing Agency ERP</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">관리자 로그인</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">카카오 계정으로 로그인하고 역할별 ERP 화면으로 이동합니다.</p>

        {kakaoConfigured ? (
          <a
            href="/api/auth/signin/kakao"
            className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-md bg-[#FEE500] px-4 text-sm font-semibold text-slate-900"
          >
            카카오로 로그인
          </a>
        ) : (
          <div className="mt-8 space-y-3">
            <button
              type="button"
              disabled
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-slate-200 px-4 text-sm font-semibold text-slate-500"
            >
              카카오 설정 필요
            </button>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p className="font-semibold">카카오 로그인 환경 변수가 아직 비어 있습니다.</p>
              <p className="mt-1">`AUTH_KAKAO_ID`와 `AUTH_KAKAO_SECRET`을 설정하면 실제 OAuth 로그인을 연결할 수 있습니다.</p>
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
