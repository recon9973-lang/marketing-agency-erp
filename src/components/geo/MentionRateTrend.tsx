// B1 — 전체 언급률 일별 추이(북극성 그래프). 인라인 SVG(외부 차트 라이브러리 미사용).
// 데이터: getMentionRateSeries(GeoAnswerRecord 파생). "0을 박제"한 기준선 + 목표선 표기.
import type { MentionRatePoint } from "@/server/geo-studio/citation";

export function MentionRateTrend({ points, target = 25 }: { points: MentionRatePoint[]; target?: number }) {
  if (points.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-10 text-center text-sm text-slate-500">
        관측이 2회 이상 쌓이면 전체 언급률 추이가 표시됩니다.
        <span className="mt-1 block text-xs text-slate-400">현재 관측 {points.length}회 · 주 1회 실측 권장</span>
      </div>
    );
  }

  const W = 640;
  const H = 220;
  const pl = 36;
  const pr = 14;
  const pt = 14;
  const pb = 30;
  const iw = W - pl - pr;
  const ih = H - pt - pb;
  const n = points.length;
  const ymax = Math.max(target, ...points.map((p) => p.rate), 10) * 1.15;

  const X = (i: number) => pl + (iw * i) / (n - 1);
  const Y = (v: number) => pt + ih * (1 - v / ymax);

  const linePts = points.map((p, i) => `${X(i)},${Y(p.rate)}`).join(" ");
  const areaPath =
    `M ${X(0)} ${Y(0)} L ` + points.map((p, i) => `${X(i)} ${Y(p.rate)}`).join(" L ") + ` L ${X(n - 1)} ${Y(0)} Z`;

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(ymax * f));
  const lastRate = points[n - 1].rate;
  const firstRate = points[0].rate;
  const delta = lastRate - firstRate;

  // x축 라벨: 처음·중간·끝 (MM/DD)
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  const xIdx = [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-2xl font-extrabold tabular-nums text-brand">{lastRate}%</span>
        <span className={`text-xs font-semibold ${delta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
          {delta >= 0 ? "▲" : "▼"} {delta >= 0 ? "+" : ""}
          {delta}%p <span className="font-normal text-slate-400">(관측 시작 대비)</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto", overflow: "visible" }} role="img" aria-label="전체 언급률 일별 추이">
        <defs>
          <linearGradient id="mrtFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d9662e" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#d9662e" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridVals.map((gv, i) => {
          const yy = Y(gv);
          return (
            <g key={i}>
              <line x1={pl} y1={yy} x2={W - pr} y2={yy} stroke="#e9ddd2" strokeWidth={1} strokeDasharray={i === 0 ? "0" : "3 4"} />
              <text x={pl - 6} y={yy + 3} textAnchor="end" fontSize={9} fill="#b6a89c" fontFamily="ui-monospace, monospace">
                {gv}%
              </text>
            </g>
          );
        })}
        {/* 목표선 */}
        <line x1={pl} y1={Y(target)} x2={W - pr} y2={Y(target)} stroke="#d9662e" strokeWidth={1.4} strokeDasharray="5 4" opacity={0.8} />
        <text x={W - pr} y={Y(target) - 4} textAnchor="end" fontSize={9} fontWeight={700} fill="#a8481a" fontFamily="ui-monospace, monospace">
          목표 {target}%
        </text>
        {/* 면적 + 라인 */}
        <path d={areaPath} fill="url(#mrtFill)" />
        <polyline points={linePts} fill="none" stroke="#d9662e" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
        {/* 기준선(첫 관측) 마킹 */}
        <circle cx={X(0)} cy={Y(firstRate)} r={4} fill="#fff" stroke="#d9662e" strokeWidth={2} />
        <text x={X(0) + 6} y={Y(firstRate) - 6} fontSize={9} fontWeight={700} fill="#a8481a" fontFamily="ui-monospace, monospace">
          기준선
        </text>
        {/* 마지막 점 강조 */}
        <circle cx={X(n - 1)} cy={Y(lastRate)} r={3.5} fill="#d9662e" />
        {/* x 라벨 */}
        {xIdx.map((idx, i) => (
          <text key={i} x={X(idx)} y={H - 9} textAnchor="middle" fontSize={9} fill="#b6a89c" fontFamily="ui-monospace, monospace">
            {md(points[idx].date)}
          </text>
        ))}
      </svg>
      <p className="mt-1 text-[11px] text-slate-400">측정 시점 스냅샷 · 언급 셀 {points[n - 1].mentioned}/{points[n - 1].total} · 변동 가능</p>
    </div>
  );
}
