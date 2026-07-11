import { BriefcaseBusiness, ClipboardList, FileText, Plane } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { WorkOverview } from "@/components/dashboard/WorkOverview";
import type { DashboardSummary } from "@/domain/dashboard";

export function MarketerDashboard({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="space-y-6">
      <DashboardHeader
        eyebrow="담당자 대시보드"
        title="오늘의 실행 업무"
        description="오늘 처리할 업무, 담당 거래처, 보고서 작업, 남은 연차를 확인합니다."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard label="오늘 업무" value={summary.todayWorkCount} tone="brand" icon={ClipboardList} description="오늘 마감이거나 처리할 업무입니다." />
        <DashboardCard label="담당 거래처" value={summary.assignedClientCount} tone="slate" icon={BriefcaseBusiness} description="현재 배정된 거래처 수입니다." />
        <DashboardCard label="보고서 작업" value={summary.reportTaskCount} tone="amber" icon={FileText} description="월간 보고서와 성과자료 작업입니다." />
        <DashboardCard label="잔여 연차" value={`${summary.leaveBalanceDays}일`} tone="green" icon={Plane} description="사용 가능한 연차 잔여일수입니다." />
      </div>

      <WorkOverview summary={summary} />
    </section>
  );
}
