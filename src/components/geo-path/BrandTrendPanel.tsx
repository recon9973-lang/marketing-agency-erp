// GEO Studio · P3 — 브랜드 검색지수 · 시계열 비교 패널(서버 렌더 SVG, 순수).
// 브랜드·카테고리·경쟁사의 데이터랩 상대지수(0~100)를 한 축에 겹쳐 그리고,
// 과거비교(전월비·구간변화·최고점 대비)를 표로. 리스닝마인드 "검색량+트렌드" 축소판.
import type { BrandTrendIndex, TrendSeries } from "@/server/geo-studio/trend/brand-index";
import { TierBadge } from "@/components/geo-common/TierBadge";
import type { DataTier } from "@/server/geo-studio/providers/port";

const ROLE_COLOR: Record<TrendSeries["role"], string> = { brand: "#d9662e", category: "#3b6fe0", competitor: "#94a3b8" };
const ROLE_LABEL: Record<TrendSeries["role"], string> = { brand: "브랜드", category: "카테고리", competitor: "경쟁사" };

// 경쟁사 여러 개면 색을 조금씩 다르게.
const COMP_COLORS = ["#8b5cf6", "#0ea5e9", "#f59e0b"];

function seriesColor(s: TrendSeries, compIndex: number): string {
  if (s.role === "competitor") return COMP_COLORS[compIndex % COMP_COLORS.length];
  return ROLE_COLOR[s.role];
}

function periodLabel(period: string): string {
  // 데이터랩은 YYYY-MM-DD, 목은 mN. 월만 축약.
  const m = /^\d{4}-(\d{2})/.exec(period);
  return m ? `${Number(m[1])}월` : period;
}

function DeltaChip({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value == null) return <span className="text-slate-300">–</span>;
  const up = value >= 0;
  return (
    <span className={`tabular-nums ${up ? "text-emerald-600" : "text-rose-500"}`}>
      {up ? "▲" : "▼"}{Math.abs(value)}{suffix}
    </span>
  );
}

export function BrandTrendPanel({ data, tier }: { data: BrandTrendIndex; tier: DataTier }) {
  const W = 720;
  const H = 200;
  const padX = 34;
  const padTop = 12;
  const padBottom = 22;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;

  const n = data.periods.length;
  const stepX = n > 1 ? innerW / (n - 1) : 0;
  const x = (i: number) => padX + i * stepX;
  const y = (v: number) => padTop + innerH - (v / 100) * innerH; // 0~100 고정 스케일

  let compSeen = -1;
  const withColor = data.series.map((s) => {
    if (s.role === "competitor") compSeen += 1;
    return { s, color: seriesColor(s, compSeen) };
  });

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <p className="text-sm font-bold text-ink">브랜드 검색지수 · 시계열 비교</p>
        <TierBadge tier={tier} note={tier === "measured" ? "데이터랩 6개월" : "데모"} />
      </div>
      <p className="mb-3 text-[11px] text-slate-400">네이버 데이터랩 상대지수(구간 최고=100). 절대 검색수가 아니라 관심도 추세입니다.</p>

      {!data.hasData ? (
        <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-10 text-center text-sm text-slate-400">
          시계열 데이터가 없습니다. 브랜드·카테고리를 입력하고 실행하세요.
        </p>
      ) : (
        <>
          {/* 다중 라인 차트 */}
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="브랜드 검색지수 시계열">
            {[0, 25, 50, 75, 100].map((g) => (
              <g key={g}>
                <line x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="#e5e7eb" strokeWidth={1} />
                <text x={padX - 6} y={y(g) + 3} textAnchor="end" className="fill-slate-300 text-[9px]">{g}</text>
              </g>
            ))}
            {n > 0 && data.periods.map((p, i) =>
              i % Math.ceil(n / 6 || 1) === 0 || i === n - 1 ? (
                <text key={p} x={x(i)} y={H - 6} textAnchor="middle" className="fill-slate-400 text-[9px]">{periodLabel(p)}</text>
              ) : null
            )}
            {withColor.map(({ s, color }) => {
              if (s.points.length < 2) return null;
              const d = s.points.map((pt, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(pt.value).toFixed(1)}`).join(" ");
              const last = s.points[s.points.length - 1];
              return (
                <g key={`${s.role}-${s.keyword}`}>
                  <path d={d} fill="none" stroke={color} strokeWidth={s.role === "brand" ? 2.5 : 1.5} strokeLinejoin="round" opacity={s.role === "competitor" ? 0.75 : 1} />
                  <circle cx={x(s.points.length - 1)} cy={y(last.value)} r={s.role === "brand" ? 3.5 : 2.5} fill={color} />
                </g>
              );
            })}
          </svg>

          {/* 범례 */}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {withColor.map(({ s, color }) => (
              <span key={`lg-${s.role}-${s.keyword}`} className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                <span className="text-slate-400">{ROLE_LABEL[s.role]}</span> {s.keyword}
              </span>
            ))}
          </div>

          {/* 과거비교 표 */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3 text-left font-semibold">키워드</th>
                  <th className="px-2 pb-2 text-right font-semibold">현재지수</th>
                  <th className="px-2 pb-2 text-right font-semibold">전월비</th>
                  <th className="px-2 pb-2 text-right font-semibold">구간변화</th>
                  <th className="pb-2 pl-2 text-right font-semibold">최고점 대비</th>
                </tr>
              </thead>
              <tbody>
                {withColor.map(({ s, color }) => (
                  <tr key={`row-${s.role}-${s.keyword}`} className="border-t border-line">
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                        <span className="font-semibold text-ink">{s.keyword}</span>
                        <span className="text-[10px] text-slate-400">{ROLE_LABEL[s.role]}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold text-slate-700">{s.latest != null ? s.latest : "–"}</td>
                    <td className="px-2 py-2 text-right"><DeltaChip value={s.deltaVsPrev} /></td>
                    <td className="px-2 py-2 text-right"><DeltaChip value={s.deltaVsFirst} /></td>
                    <td className="py-2 pl-2 text-right tabular-nums text-slate-500">{s.vsPeakPct != null ? `${s.vsPeakPct}%` : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
