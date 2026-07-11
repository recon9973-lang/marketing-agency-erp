// ERP 공통 로딩 스켈레톤.
// (erp) 그룹의 모든 하위 페이지가 서버에서 데이터를 불러오는 동안 즉시 표시된다.
// 이게 없으면 링크 클릭 시 이전 화면이 그대로 멈춰 "느리다"는 체감이 커진다.
// 또한 Next.js가 이 경계를 프리페치해, 클릭 즉시 스켈레톤이 뜨도록 만든다.
export default function ErpLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
      {/* 헤더 자리 (신규 PageHeader 톤과 일치 — 좌측바 없음) */}
      <div>
        <div className="h-3 w-24 rounded bg-line" />
        <div className="mt-2 h-6 w-56 rounded bg-line" />
        <div className="mt-3 h-4 w-80 max-w-full rounded bg-slate-100" />
      </div>

      {/* 상단 요약 카드 자리 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-white p-4">
            <div className="h-3 w-16 rounded bg-slate-100" />
            <div className="mt-3 h-6 w-24 rounded bg-line" />
          </div>
        ))}
      </div>

      {/* 표/목록 자리 */}
      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="h-4 w-40 rounded bg-line" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-1/4 rounded bg-slate-100" />
              <div className="h-4 w-1/5 rounded bg-slate-100" />
              <div className="h-4 w-1/6 rounded bg-slate-100" />
              <div className="ml-auto h-4 w-16 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
