import { redirect } from "next/navigation";
import { ReportForm } from "@/components/reports/ReportForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { createReportAction } from "@/server/actions/report";
import { fetchClientsForUser } from "@/server/repositories/clients";
import { getCurrentUser } from "@/server/session";

export default async function NewReportPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const clients = await fetchClientsForUser(user);

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="보고서" title="새 보고서 작성" description="거래처 월간 보고서를 작성합니다." />
      <div className="rounded-md border border-line bg-white p-6">
        <ReportForm
          action={createReportAction}
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
          submitLabel="작성"
        />
      </div>
    </section>
  );
}
