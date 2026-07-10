import Link from "next/link";
import type { Route } from "next";
import type { ClientMonitorRow } from "@/server/repositories/dashboard-extras";

// 전사 운영 모니터링 표 — 최고관리자 대시보드 전용. rows가 비면 렌더하지 않음.
const won = new Intl.NumberFormat("ko-KR");

export function ClientMonitor({ rows }: { rows: ClientMonitorRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-ink">거래처 운영 모니터링</p>
        <Link href={"/clients" as Route} className="text-xs font-bold text-brand-strong">거래처 전체 →</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3 text-left font-semibold">거래처</th>
              <th className="px-2 pb-2 text-right font-semibold">전체 업무</th>
              <th className="px-2 pb-2 text-right font-semibold">지연</th>
              <th className="px-2 pb-2 text-right font-semibold">검토</th>
              <th className="pb-2 pl-2 text-right font-semibold">미수금</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-2.5 pr-3 font-semibold text-ink">{r.name}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">{r.total}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  <span className={r.delayed > 0 ? "font-bold text-rose-600" : "text-slate-300"}>{r.delayed}</span>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  <span className={r.review > 0 ? "font-bold text-amber-600" : "text-slate-300"}>{r.review}</span>
                </td>
                <td className="py-2.5 pl-2 text-right tabular-nums">
                  <span className={r.outstanding > 0 ? "font-bold text-ink" : "text-slate-300"}>
                    {r.outstanding > 0 ? `${won.format(r.outstanding)}원` : "-"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
