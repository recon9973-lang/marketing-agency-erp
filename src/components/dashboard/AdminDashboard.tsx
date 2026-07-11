import { AlertTriangle, CalendarClock, CircleCheck, Plane } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { WorkOverview } from "@/components/dashboard/WorkOverview";
import type { DashboardSummary } from "@/domain/dashboard";

export function AdminDashboard({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="space-y-6">
      <DashboardHeader
        eyebrow="관리자 대시보드"
        title="지정 범위 운영 현황"
        description="최고관리자가 지정한 담당자와 거래처 범위 안에서 지연, 검토, 일정 충돌을 확인합니다."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard label="범위 내 지연 업무" value={summary.delayedWorkCount} tone="rose" icon={AlertTriangle} description="담당 범위에서 지연된 업무입니다." />
        <DashboardCard label="검토 필요" value={summary.reviewNeededWorkCount} tone="amber" icon={CircleCheck} description="관리자 확인이 필요한 업무입니다." />
        <DashboardCard label="다가오는 마감" value={summary.upcomingDeadlineCount} tone="brand" icon={CalendarClock} description="오늘 이후 처리할 일정입니다." />
        <DashboardCard label="휴가 승인 대기" value={summary.pendingLeaveCount} tone="amber" icon={Plane} description="처리가 필요한 휴가 요청입니다." />
      </div>

      <WorkOverview summary={summary} />
    </section>
  );
}
