import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { CreateWeeklyReportForm } from "@/components/weekly/CreateWeeklyReportForm";
import { WeeklyReportList, type WeeklyItem } from "@/components/weekly/WeeklyReportList";
import { fetchWeeklyReportsForUser } from "@/server/repositories/weekly-reports";
import { getCurrentUser } from "@/server/session";

export default async function WeeklyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const reports = await fetchWeeklyReportsForUser(user);
  const items: WeeklyItem[] = reports.map((w) => ({
    id: w.id,
    authorName: w.authorName,
    weekStart: new Date(w.weekStart).toISOString(),
    summary: w.summary,
    achievements: w.achievements,
    plans: w.plans,
    issues: w.issues,
    editable: w.editable
  }));

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="업무 보고"
        title="주간 업무보고"
        description="한 주 동안의 업무를 요약해 제출합니다. 관리자는 모든 직원의 주간보고를, 담당자는 본인 보고를 확인할 수 있습니다."
      />
      <CreateWeeklyReportForm />
      <WeeklyReportList items={items} />
    </div>
  );
}
