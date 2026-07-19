// C1 — 월보장 순위 일별 추이(SEO 트랙). 순위는 낮을수록 좋으므로 1위를 위로(반전). 인라인 SVG.
// 데이터: getGuardedRankSeries(ExposureSnapshot 파생). 목표순위 점선 + 이탈 적색 마킹.
import type { GuardedRankSeries } from "@/server/repositories/citation-score";

export function GuardedRankTrend({ series }: { series: GuardedRankSeries }) {
  const pts = series.points.filter((p) => typeof p.rank === "number") as { date: string; rank: number }[];
  if (pts.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-8 text-center text-sm text-slate-500">
        <b className="text-slate-600">{series.keyword}</b> — 순위 스냅샷이 2회 이상 쌓이면 추이가 표시됩니다.
        <span className="mt-1 block text-xs text-slate-400">매일 순위감시(guard-rank)로 자동 축적</span>
      </div>
    );
  }

  const W = 640;
  const H = 210;
  const pl = 32;
  const pr = 14;
  const pt = 16;
  const pb = 28;
  const iw = W - pl - pr;
  const ih = H - pt - pb;
  const n = pts.length;
  const target = series.targetRank ?? 1;
  const rmax = Math.max(5, ...pts.map((p) => p.rank));
  const rmin = 1;

  const X = (i: number) => pl + (iw * i) / (n - 1);
  const Y = (r: number) => pt + (ih * (r - rmin)) / (rmax - rmin); // 1위 = 최상단

  const linePts = pts.map((p, i) => `${X(i)},${Y(p.rank)}`).join(" ");
  const ranks: number[] = [];
  for (let g = rmin; g <= rmax; g++) ranks.push(g);
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  const xIdx = [0, Math.floor((n - 1) / 2), n - 1];
  const latest = pts[n - 1].rank;
  const held = latest <= target;

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-sm font-bold text-ink">{series.keyword}</span>
        <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${held ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
          현재 {latest}위 {held ? "· 보장 유지" : "· 이탈"}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto", overflow: "visible" }} role="img" aria-label="월보장 순위 일별 추이">
        {ranks.map((g, i) => {
          const yy = Y(g);
          return (
            <g key={i}>
              <line x1={pl} y1={yy} x2={W - pr} y2={yy} stroke="#e9ddd2" strokeWidth={1} strokeDasharray={g === rmin ? "0" : "3 4"} />
              <text x={pl - 6} y={yy + 3} textAnchor="end" fontSize={9} fill="#b6a89c" fontFamily="ui-monospace, monospace">
                {g}위
              </text>
            </g>
          );
        })}
        {/* 목표 순위 점선 */}
        <line x1={pl} y1={Y(target)} x2={W - pr} y2={Y(target)} stroke="#2f6fb0" strokeWidth={1.4} strokeDasharray="5 4" opacity={0.85} />
        <text x={W - pr} y={Y(target) + 12} textAnchor="end" fontSize={9} fontWeight={700} fill="#2f6fb0" fontFamily="ui-monospace, monospace">
          목표 {target}위(보장)
        </text>
        <polyline points={linePts} fill="none" stroke="#2f6fb0" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
        {/* 이탈(목표 초과) 지점 적색 */}
        {pts.map((p, i) =>
          p.rank > target ? <circle key={i} cx={X(i)} cy={Y(p.rank)} r={3.6} fill="#c0492b" /> : null
        )}
        <circle cx={X(n - 1)} cy={Y(latest)} r={3.5} fill="#2f6fb0" />
        {xIdx.map((idx, i) => (
          <text key={i} x={X(idx)} y={H - 8} textAnchor="middle" fontSize={9} fill="#b6a89c" fontFamily="ui-monospace, monospace">
            {md(pts[idx].date)}
          </text>
        ))}
      </svg>
      <p className="mt-1 text-[11px] text-slate-400">채널 {series.channel} · 매일 자동 축적 · 이탈 감지 시 알림</p>
    </div>
  );
}
