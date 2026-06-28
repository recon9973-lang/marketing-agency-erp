import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { DashboardSummary } from "@/domain/dashboard";

export function MarketerDashboard({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-brand">담당자 대시보드</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">오늘의 실행 업무</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          오늘 처리할 업무, 담당 거래처, 보고서 작업, 남은 연차를 확인합니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard label="오늘 업무" value={summary.todayWorkCount} description="오늘 마감이거나 처리할 업무입니다." />
        <DashboardCard label="담당 거래처" value={summary.assignedClientCount} description="현재 배정된 거래처 수입니다." />
        <DashboardCard label="보고서 작업" value={summary.reportTaskCount} description="월간 보고서와 성과자료 작업입니다." />
        <DashboardCard label="잔여 연차" value={`${summary.leaveBalanceDays}일`} description="사용 가능한 연차 잔여일수입니다." />
      </div>
    </section>
  );
}
