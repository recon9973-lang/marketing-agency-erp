// B4 — 언급 현황(우리 + 경쟁사 랭킹). 질문×엔진 최신 셀 기준. 순수 표시.
import type { StandingRow } from "@/server/repositories/citation-score";

const DOT = ["#221912", "#c0492b", "#8a5cc0", "#3f9b6b", "#c79a2a", "#2f6fb0", "#c07d16", "#8b7d72", "#b0468a"];

export function MentionStanding({ rows }: { rows: StandingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-8 text-center text-sm text-slate-500">
        관측이 쌓이면 우리·경쟁사 언급 현황이 표시됩니다.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line">
            <th className="py-1.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-500">브랜드</th>
            <th className="py-1.5 text-right font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-500">언급률</th>
            <th className="py-1.5 text-right font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-500">모델</th>
            <th className="py-1.5 text-right font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-500">평균순위</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} className={`border-b border-line/50 last:border-0 ${r.isUs ? "bg-brand/5 font-semibold" : ""}`}>
              <td className="py-1.5">
                <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: DOT[i % DOT.length] }} />
                {r.name}
                {r.isUs && <span className="ml-1.5 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">우리</span>}
              </td>
              <td className={`py-1.5 text-right font-mono tabular-nums ${r.isUs ? "text-brand" : "text-slate-600"}`}>{r.rate}%</td>
              <td className="py-1.5 text-right font-mono tabular-nums text-slate-500">{r.models}개</td>
              <td className="py-1.5 text-right font-mono tabular-nums text-slate-500">{r.avgRank === null ? "—" : `${r.avgRank}위`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
