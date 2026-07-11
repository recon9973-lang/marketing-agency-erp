import Link from "next/link";

// 공개 랜딩 — 정적(프리렌더). 인증/DB를 첫 화면 경로에서 제거해 콜드스타트 대기 없이 즉시 뜬다.
// (로그인 여부는 필요 없음: "ERP 바로가기"는 /dashboard로 보내고, 미인증이면 거기서 /login 리다이렉트)
export const dynamic = "force-static";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <section className="w-full max-w-xl">
        <p className="text-sm font-semibold text-brand">Marketing Agency ERP</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal text-ink">업무 운영 시스템</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          카카오 로그인 후 역할별 대시보드에서 거래처, 업무, 일정, 정산, 휴가, 보고서를 관리합니다.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="inline-flex h-11 items-center rounded-md bg-brand px-5 text-sm font-semibold text-white">
            관리자 로그인
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center rounded-md border border-line bg-white px-5 text-sm font-semibold text-ink"
          >
            ERP 바로가기
          </Link>
        </div>
      </section>
    </main>
  );
}
