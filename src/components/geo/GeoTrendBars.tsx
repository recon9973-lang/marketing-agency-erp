// 목표 경로: src/components/geo/GeoTrendBars.tsx
//
// 월별 출현 추이 미니 바 차트 — 단일 시리즈(출현률 %) 컬럼. 서버 컴포넌트(순수 마크업).
// 색: emerald-600(#059669) — 라이트/다크 표면 대비 3:1 이상 검증 완료(dataviz 6-checks).
// 값은 색이 아닌 텍스트 레이블(잉크 토큰)로 병기 — 색약/인쇄 대응.
import type { GeoTrendPoint } from "@/server/repositories/geo";

export function GeoTrendBars({ trend }: { trend: GeoTrendPoint[] }) {
  if (trend.length === 0) return null;

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold text-ink">월별 출현 추이</p>
        <p className="text-[10px] text-slate-400">관측 질문 대비 출현 질문 비율 · 모니터링 지표</p>
      </div>
      <div className="mt-3 flex items-end gap-3">
        {trend.map((t) => {
          const month = `${Number(t.month.slice(5, 7))}월`;
          return (
            <div
              key={t.month}
              className="flex min-w-[34px] flex-col items-center gap-1"
              title={`${t.month} · 출현 ${t.appeared} / 관측 ${t.monitored}`}
            >
              <span className="text-[10px] font-bold text-ink">{t.rate}%</span>
              <div className="flex h-14 w-full items-end justify-center" aria-hidden="true">
                <div
                  className="w-4 rounded-t bg-emerald-600"
                  style={{ height: `${Math.max(t.rate, 4)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400">{month}</span>
              <span className="sr-only">{`${t.month} 출현률 ${t.rate}% (출현 ${t.appeared}, 관측 ${t.monitored})`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
