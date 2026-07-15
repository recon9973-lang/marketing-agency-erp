// ERP 공통 로딩 — 화면 전환/서버 대기 동안 "가운데 로더" 대신 페이지 모양 골격을 즉시 표시.
// 대기 구간이 "로딩 중"이 아니라 "페이지가 그려지는 중"으로 읽혀 체감 지연을 낮춘다.
// (erp) 그룹의 모든 하위 페이지가 서버 데이터를 불러오는 동안 즉시 뜬다.
// 브랜드 로더가 필요하면 @/components/erp/FunLoader 의 <FunLoader/>로 되돌리면 된다.
export default function ErpLoading() {
  return (
    <div className="space-y-6" aria-hidden>
      {/* 제목 줄 + 액션 버튼 자리 */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded-md bg-slate-100" />
          <div className="h-3.5 w-72 animate-pulse rounded bg-slate-100/80" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-md bg-slate-100" />
      </div>

      {/* 상단 카드 줄 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-line bg-slate-100/70" />
        ))}
      </div>

      {/* 본문 — 넓은 목록/패널 자리 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="h-11 animate-pulse rounded-xl border border-line bg-slate-100/70" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-line bg-slate-100/60" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-2xl border border-line bg-slate-100/70" />
      </div>
    </div>
  );
}
