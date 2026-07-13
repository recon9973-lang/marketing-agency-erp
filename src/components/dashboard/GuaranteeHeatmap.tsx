import Link from "next/link";
import type { Route } from "next";
import { ShieldCheck, TrendingDown } from "lucide-react";
import type { GuaranteeCell, GuaranteeClientRow, GuaranteeHeatmap as Data, GuaranteeStatus } from "@/server/repositories/rank-guarantee";

// 상태별 셀 스타일 — 빨강(이탈) → 주황(미달) → 초록(유지) → 회색(대기).
const CELL: Record<GuaranteeStatus, { box: string; label: string }> = {
  DROPPED: { box: "bg-rose-100 border-rose-200 text-rose-700", label: "이탈" },
  BELOW_TARGET: { box: "bg-amber-100 border-amber-200 text-amber-700", label: "미달" },
  MAINTAINED: { box: "bg-emerald-100 border-emerald-200 text-emerald-700", label: "유지" },
  PENDING: { box: "bg-slate-100 border-slate-200 text-slate-400", label: "대기" }
};

function rankText(cell: GuaranteeCell): string {
  if (cell.status === "PENDING") return "—";
  if (cell.rank == null) return "미노출";
  return `${cell.rank}위`;
}

function Cell({ cell }: { cell: GuaranteeCell }) {
  const s = CELL[cell.status];
  const target = cell.targetRank != null ? `목표 ${cell.targetRank}위` : "목표 미설정";
  return (
    <div
      className={`flex w-[104px] shrink-0 flex-col gap-0.5 rounded-lg border px-2 py-1.5 ${s.box}`}
      title={`${cell.keyword} · ${cell.channel} · ${target} · ${rankText(cell)}${cell.checkedOn ? ` · ${cell.checkedOn}` : ""}`}
    >
      <span className="truncate text-[11px] font-semibold leading-tight">{cell.keyword}</span>
      <span className="flex items-center justify-between text-[10.5px]">
        <span className="font-bold">{rankText(cell)}</span>
        <span className="opacity-70">{s.label}</span>
      </span>
    </div>
  );
}

function ClientRow({ row }: { row: GuaranteeClientRow }) {
  return (
    <div className="flex items-start gap-3 border-b border-line py-2.5 last:border-0">
      <div className="w-32 shrink-0 pt-1">
        <b className="block truncate text-[13px] text-ink" title={row.clientName}>{row.clientName}</b>
        <span className="text-[10.5px] text-slate-400">
          {row.dropped > 0 && <span className="font-bold text-rose-600">이탈 {row.dropped} </span>}
          {row.belowTarget > 0 && <span className="font-bold text-amber-600">미달 {row.belowTarget} </span>}
          {row.dropped === 0 && row.belowTarget === 0 && <span className="text-emerald-600">전체 유지</span>}
        </span>
      </div>
      <div className="flex flex-1 flex-wrap gap-1.5">
        {row.cells.map((c) => <Cell key={c.keywordId} cell={c} />)}
      </div>
    </div>
  );
}

export function GuaranteeHeatmap({ data }: { data: Data }) {
  if (data.totalKeywords === 0) return null; // 보장 키워드가 없으면 노출하지 않음

  const alert = data.droppedTotal + data.belowTotal;

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <ShieldCheck className="h-4 w-4 text-emerald-500" /> 순위 보장 현황
        </p>
        <span className="text-[11px] text-slate-400">보장 키워드 {data.totalKeywords}개</span>
        {alert > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600">
            <TrendingDown className="h-3 w-3" /> 조치 필요 {alert}
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">전체 보장 유지</span>
        )}
        <Link href={"/keywords" as Route} className="ml-auto text-xs font-bold text-brand-strong">키워드 관리 →</Link>
      </div>

      {/* 범례 */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[10.5px] text-slate-500">
        {(["DROPPED", "BELOW_TARGET", "MAINTAINED", "PENDING"] as GuaranteeStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-sm border ${CELL[s].box}`} /> {CELL[s].label}
          </span>
        ))}
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {data.rows.map((row) => <ClientRow key={row.clientId} row={row} />)}
      </div>
    </section>
  );
}
