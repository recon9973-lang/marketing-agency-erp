// 월간 리포트 요약 카드 — VENOM GEO 케이스(PDF)의 리포트 목차 구조.
// 대표지표=AI 언급률. 순위 유지율·발행 실적 함께. 순수 표시(값은 서버 집계).
export type GeoReportData = {
  mentionStart: number | null; // 관측 시작 언급률(%)
  mentionNow: number | null; // 현재 언급률(%)
  citedCount: number; // 공식 URL 인용 질문 수
  monitoredCount: number; // 관측 중 질문 수
  guardHeld: number; // 월보장 순위 유지 키워드 수
  guardTotal: number; // 월보장 키워드 수
  publishedCount: number; // 발행 콘텐츠 수
};

export function GeoMonthlyReport({ data, clientName }: { data: GeoReportData; clientName: string }) {
  const hasData = data.mentionNow !== null || data.monitoredCount > 0;
  const delta = data.mentionStart !== null && data.mentionNow !== null ? data.mentionNow - data.mentionStart : null;

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-strong">리포트</span>
        <h3 className="text-sm font-bold text-ink">{clientName} · 월간 요약</h3>
        <span className="text-[10px] text-slate-400">대표지표: AI 언급률</span>
      </div>
      {!hasData ? (
        <p className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-6 text-center text-sm text-slate-500">
          관측·발행이 쌓이면 월간 리포트가 자동 집계됩니다.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface/60 p-3">
            <p className="text-[11px] text-slate-500">AI 언급률 ★</p>
            <p className="mt-1 text-lg font-extrabold text-brand">
              {data.mentionStart ?? 0}% → {data.mentionNow ?? 0}%
            </p>
            {delta !== null && (
              <p className={`mt-0.5 text-[10px] font-semibold ${delta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                {delta >= 0 ? "▲ +" : "▼ "}
                {delta}%p
              </p>
            )}
          </div>
          <div className="rounded-xl border border-line bg-surface/60 p-3">
            <p className="text-[11px] text-slate-500">공식 URL 인용</p>
            <p className="mt-1 text-lg font-extrabold text-ink">
              {data.citedCount}
              <span className="text-xs font-medium text-slate-400"> / {data.monitoredCount}질문</span>
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">권위·인용</p>
          </div>
          <div className="rounded-xl border border-line bg-surface/60 p-3">
            <p className="text-[11px] text-slate-500">월보장 유지율</p>
            <p className="mt-1 text-lg font-extrabold text-sky-700">
              {data.guardTotal > 0 ? Math.round((data.guardHeld / data.guardTotal) * 100) : 0}%
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {data.guardHeld}/{data.guardTotal}건 유지 (SEO)
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface/60 p-3">
            <p className="text-[11px] text-slate-500">발행 실적</p>
            <p className="mt-1 text-lg font-extrabold text-ink">{data.publishedCount}건</p>
            <p className="mt-0.5 text-[10px] text-slate-400">게시 콘텐츠</p>
          </div>
        </div>
      )}
    </div>
  );
}
