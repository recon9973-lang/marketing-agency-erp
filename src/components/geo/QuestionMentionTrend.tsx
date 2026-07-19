// B3 — 질문별 언급률 추이(멀티라인). 질문마다 한 선. 인라인 SVG.
import type { QuestionMentionSeries } from "@/server/repositories/citation-score";

const COLORS = ["#d9662e", "#2f6fb0", "#3f9b6b", "#8a5cc0", "#c79a2a", "#c0492b"];

export function QuestionMentionTrend({ data }: { data: QuestionMentionSeries }) {
  const { dates, questions } = data;
  if (dates.length < 2 || questions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-10 text-center text-sm text-slate-500">
        관측이 2회 이상 쌓이면 질문별 언급률 추이가 표시됩니다.
      </div>
    );
  }

  const W = 640;
  const H = 230;
  const pl = 34;
  const pr = 12;
  const pt = 12;
  const pb = 28;
  const iw = W - pl - pr;
  const ih = H - pt - pb;
  const n = dates.length;
  const X = (i: number) => pl + (iw * i) / (n - 1);
  const Y = (v: number) => pt + ih * (1 - v / 100);
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  const xIdx = [0, Math.floor((n - 1) / 2), n - 1];

  // null(미관측) 구간은 선을 끊어 그린다.
  function segments(points: (number | null)[]): string[] {
    const segs: string[] = [];
    let cur: string[] = [];
    points.forEach((v, i) => {
      if (v === null) {
        if (cur.length > 1) segs.push(cur.join(" "));
        cur = [];
      } else {
        cur.push(`${X(i)},${Y(v)}`);
      }
    });
    if (cur.length > 1) segs.push(cur.join(" "));
    return segs;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: "visible" }} role="img" aria-label="질문별 언급률 추이">
        {[0, 25, 50, 75, 100].map((gv, i) => (
          <g key={i}>
            <line x1={pl} y1={Y(gv)} x2={W - pr} y2={Y(gv)} stroke="#e9ddd2" strokeWidth={1} strokeDasharray={gv === 0 ? "0" : "3 4"} />
            <text x={pl - 6} y={Y(gv) + 3} textAnchor="end" fontSize={9} fill="#b6a89c" fontFamily="ui-monospace, monospace">
              {gv}%
            </text>
          </g>
        ))}
        {questions.map((q, qi) =>
          segments(q.points).map((seg, si) => (
            <polyline key={`${qi}-${si}`} points={seg} fill="none" stroke={COLORS[qi % COLORS.length]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
          ))
        )}
        {xIdx.map((idx, i) => (
          <text key={i} x={X(idx)} y={H - 8} textAnchor="middle" fontSize={9} fill="#b6a89c" fontFamily="ui-monospace, monospace">
            {md(dates[idx])}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {questions.map((q, qi) => (
          <span key={qi} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="h-2 w-2 rounded-full" style={{ background: COLORS[qi % COLORS.length] }} />
            <span className="max-w-[220px] truncate">{q.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
