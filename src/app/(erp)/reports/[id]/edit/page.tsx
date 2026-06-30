import { redirect } from "next/navigation";
import { ReportForm } from "@/components/reports/ReportForm";
import { ReportStatusActions } from "@/components/reports/ReportStatusActions";
import { PageHeader } from "@/components/ui/PageHeader";
import { canAccessClient } from "@/domain/access-control";
import { updateReportAction } from "@/server/actions/report";
import { fetchClientsForUser } from "@/server/repositories/clients";
import { getReportAccessInfo, getReportDetail } from "@/server/repositories/reports";
import { loadAccessScopes } from "@/server/scope";
import { getCurrentUser } from "@/server/session";

export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const [detail, accessInfo] = await Promise.all([getReportDetail(id), getReportAccessInfo(id)]);

  if (!detail || !accessInfo) {
    redirect("/reports");
  }

  const scopes = await loadAccessScopes(user);
  if (!canAccessClient(user, accessInfo.clientId, scopes, accessInfo.clientAssignedMarketerId)) {
    redirect("/reports");
  }

  const clients = await fetchClientsForUser(user);

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="보고서" title={`${detail.title} 수정`} description="보고서 내용과 검토 상태를 관리합니다." />

      <div className="rounded-md border border-line bg-white p-6">
        <ReportStatusActions reportId={detail.id} status={accessInfo.status} />
      </div>

      <div className="rounded-md border border-line bg-white p-6">
        <ReportForm
          action={updateReportAction}
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
          initialValue={detail}
          submitLabel="저장"
        />
      </div>
    </section>
  );
}
