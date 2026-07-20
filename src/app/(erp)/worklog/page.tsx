import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkReportBoard } from "@/components/work/WorkReportBoard";
import { workCategoryLabels } from "@/domain/work";
import { WorkCategory, Role } from "@/domain/types";
import { listWorkReports } from "@/server/repositories/work-report";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "업무 보고" };

export default async function WorkLogPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { reports, clients } = await listWorkReports(user);
  const categories = Object.values(WorkCategory).map((c) => workCategoryLabels[c]);
  const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
  // 로컬(KST) 기준 오늘 날짜.
  const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="업무 · 결과물"
        title="업무 보고"
        description="담당 거래처의 당일 작업 결과물(블로그·포스팅·이미지 등)을 링크와 함께 남깁니다. 카카오톡에 올리던 결과물 보고를 ERP 안에서 처리하고 이력으로 축적합니다."
      />
      <WorkReportBoard
        reports={reports}
        clients={clients}
        categories={categories}
        todayISO={todayISO}
        viewerId={user.id}
        isManager={isManager}
      />
    </section>
  );
}
