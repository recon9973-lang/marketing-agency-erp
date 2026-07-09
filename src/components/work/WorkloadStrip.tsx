// 이번 주 담당자별 워크로드 — 기록 공수 vs 주간 가용시간. 관리자 화면용.
import type { WorkloadRow } from "@/server/repositories/time";

function hours(min: number) {
  return (min / 60).toFixed(1);
}

export function WorkloadStrip({ rows }: { rows: WorkloadRow[] }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">이번 주 워크로드 (기록 공수 / 가용)</h3>
        <span className="text-[11px] text-slate-400">담당자별 시간 기록 합계 기준</span>
      </div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const pct = r.capacityMinutes > 0 ? Math.min(100, Math.round((r.loggedMinutes / r.capacityMinutes) * 100)) : 0;
          const over = r.loggedMinutes > r.capacityMinutes && r.capacityMinutes > 0;
          return (
            <div key={r.userId} className="rounded-lg border border-line bg-surface/40 p-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink">{r.name}</span>
                <span className={over ? "font-bold text-danger" : "text-slate-500"}>
                  {hours(r.loggedMinutes)}h / {hours(r.capacityMinutes)}h
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div
                  className={over ? "h-full bg-danger" : "h-full bg-brand"}
                  style={{ width: `${Math.max(pct, r.loggedMinutes > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
