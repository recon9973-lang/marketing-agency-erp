// B2 — AI 모델별 언급률 레이더(첫 관측 vs 최신). 인라인 SVG + 델타표.
import type { EngineRadar as EngineRadarData } from "@/server/repositories/citation-score";

const ENGINE_LABELS: Record<string, string> = {
  CHATGPT: "ChatGPT",
  GEMINI: "Gemini",
  CLAUDE: "Claude",
  PERPLEXITY: "Perplexity",
  AI_OVERVIEW: "Google AI",
  NAVER_AI: "Naver AI"
};
const lbl = (e: string) => ENGINE_LABELS[e] ?? e;

export function EngineRadar({ data }: { data: EngineRadarData }) {
  const engines = data.engines;
  if (engines.length < 3) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-10 text-center text-sm text-slate-500">
        엔진 3개 이상 관측이 쌓이면 모델별 분포가 표시됩니다.
        <span className="mt-1 block text-xs text-slate-400">현재 엔진 {engines.length}개</span>
      </div>
    );
  }

  const W = 300;
  const H = 240;
  const cx = W / 2;
  const cy = H / 2;
  const R = 80;
  const N = engines.length;
  const singlePoint = data.beforeDate === data.nowDate;

  const pt = (i: number, frac: number): [number, number] => {
    const a = -Math.PI / 2 + (i / N) * 2 * Math.PI;
    return [cx + R * frac * Math.cos(a), cy + R * frac * Math.sin(a)];
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, Math.max(0, Math.min(1, v / 100))).join(",")).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto" style={{ maxWidth: 320, overflow: "visible" }} role="img" aria-label="AI 모델별 언급률 레이더">
        {[0.25, 0.5, 0.75, 1].map((f, k) => (
          <polygon key={k} points={engines.map((_, i) => pt(i, f).join(",")).join(" ")} fill="none" stroke="#e9ddd2" strokeWidth={1} />
        ))}
        {engines.map((e, i) => {
          const p = pt(i, 1);
          const lp = pt(i, 1.16);
          const anchor = lp[0] < cx - 5 ? "end" : lp[0] > cx + 5 ? "start" : "middle";
          return (
            <g key={e.engine}>
              <line x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="#e9ddd2" strokeWidth={1} />
              <text x={lp[0]} y={lp[1] + 3} textAnchor={anchor} fontSize={10} fill="#8b7d72" fontFamily="ui-monospace, monospace">
                {lbl(e.engine)}
              </text>
            </g>
          );
        })}
        {!singlePoint && (
          <polygon points={poly(engines.map((e) => e.before))} fill="#8b7d72" fillOpacity={0.06} stroke="#8b7d72" strokeWidth={1.5} strokeDasharray="4 3" />
        )}
        <polygon points={poly(engines.map((e) => e.now))} fill="#d9662e" fillOpacity={0.16} stroke="#d9662e" strokeWidth={2} />
        {engines.map((e, i) => {
          const p = pt(i, Math.max(0, Math.min(1, e.now / 100)));
          return <circle key={e.engine} cx={p[0]} cy={p[1]} r={2.6} fill="#d9662e" />;
        })}
      </svg>
      <div className="mt-1 flex justify-center gap-4 font-mono text-[10px] text-slate-400">
        {!singlePoint && <span>◇ 기존({data.beforeDate?.slice(5)})</span>}
        <span className="text-brand">◆ 현재({data.nowDate?.slice(5)})</span>
      </div>
      <table className="mt-3 w-full text-xs">
        <tbody>
          {engines.map((e) => {
            const d = e.now - e.before;
            const cls = d > 0 ? "text-emerald-600" : d < 0 ? "text-rose-500" : "text-slate-400";
            const ar = d > 0 ? "▲" : d < 0 ? "▼" : "—";
            return (
              <tr key={e.engine} className="border-b border-line/60 last:border-0">
                <td className="py-1">{lbl(e.engine)}</td>
                {!singlePoint && <td className="py-1 text-right font-mono text-slate-400">{e.before}%</td>}
                <td className="py-1 text-right font-mono font-bold">{e.now}%</td>
                {!singlePoint && (
                  <td className={`py-1 text-right font-mono font-semibold ${cls}`}>
                    {ar} {d > 0 ? "+" : ""}
                    {d}%p
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
