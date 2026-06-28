import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { DashboardSummary } from "@/domain/dashboard";

export function AdminDashboard({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-brand">관리자 대시보드</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">지정 범위 운영 현황</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          최고관리자가 지정한 담당자와 거래처 범위 안에서 지연, 검토, 일정 충돌을 확인합니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard label="범위 내 지연 업무" value={summary.delayedWorkCount} description="담당 범위에서 지연된 업무입니다." />
        <DashboardCard label="검토 필요" value={summary.reviewNeededWorkCount} description="관리자 확인이 필요한 업무입니다." />
        <DashboardCard label="다가오는 마감" value={summary.upcomingDeadlineCount} description="오늘 이후 처리할 일정입니다." />
        <DashboardCard label="휴가 승인 대기" value={summary.pendingLeaveCount} description="처리가 필요한 휴가 요청입니다." />
      </div>
    </section>
  );
}
