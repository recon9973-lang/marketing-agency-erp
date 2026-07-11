// 목표 경로: src/components/dashboard/WorkOverview.tsx
//
// 대시보드 업무 진행 개요 — 완료율 도넛(SVG) + 상태별 진행바 + 처리 대기 큐.
// 외부 차트 라이브러리 없이 순수 SVG/CSS로 구현.
import type { DashboardSummary } from "@/domain/dashboard";

// 완료율 도넛(SVG). value/total 비율을 브랜드 색 링으로 표시.
function ProgressDonut({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <div className="relative flex h-[132px] w-[132px] shrink-0 items-center justify-center">
      <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
        <circle cx="66" cy="66" r={r} fill="none" stroke="#f1eeea" strokeWidth="12" />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke="#d9662e"
          strokeWidth="12"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-ink">{pct}%</span>
        <span className="text-[11px] text-slate-400">완료율</span>
      </div>
    </div>
  );
}

// 상태별 진행바 한 줄.
function StatBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-ink">{value}건</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function WorkOverview({ summary }: { summary: DashboardSummary }) {
  const total = summary.totalWorkCount;
  const inProgress = Math.max(0, total - summary.completedWorkCount);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* 완료율 */}
      <div className="flex items-center gap-5 rounded-2xl border border-line bg-white p-5">
        <ProgressDonut value={summary.completedWorkCount} total={total} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">업무 완료율</p>
          <p className="mt-1 text-xs text-slate-500">전체 {total}건 중 {summary.completedWorkCount}건 완료</p>
          <p className="mt-3 text-xs text-slate-500">진행 중 <span className="font-semibold text-ink">{inProgress}건</span></p>
        </div>
      </div>

      {/* 상태 분해 */}
      <div className="space-y-3 rounded-2xl border border-line bg-white p-5">
        <p className="text-sm font-bold text-ink">업무 상태 분포</p>
        <StatBar label="완료" value={summary.completedWorkCount} total={total} color="bg-emerald-500" />
        <StatBar label="지연" value={summary.delayedWorkCount} total={total} color="bg-rose-500" />
        <StatBar label="검토 필요" value={summary.reviewNeededWorkCount} total={total} color="bg-amber-500" />
        <StatBar label="오늘 마감" value={summary.todayWorkCount} total={total} color="bg-brand" />
      </div>

      {/* 처리 대기 큐 */}
      <div className="rounded-2xl border border-line bg-white p-5">
        <p className="text-sm font-bold text-ink">처리 대기</p>
        <ul className="mt-3 space-y-2.5">
          <QueueRow label="지연된 업무" count={summary.delayedWorkCount} tone="rose" />
          <QueueRow label="검토 필요" count={summary.reviewNeededWorkCount} tone="amber" />
          <QueueRow label="다가오는 마감" count={summary.upcomingDeadlineCount} tone="brand" />
          <QueueRow label="휴가 승인 대기" count={summary.pendingLeaveCount} tone="amber" />
        </ul>
      </div>
    </div>
  );
}

function QueueRow({ label, count, tone }: { label: string; count: number; tone: "rose" | "amber" | "brand" }) {
  const dot = tone === "rose" ? "bg-rose-500" : tone === "amber" ? "bg-amber-500" : "bg-brand";
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-slate-600">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </span>
      <span className={`text-sm font-bold ${count > 0 ? "text-ink" : "text-slate-300"}`}>{count}</span>
    </li>
  );
}
