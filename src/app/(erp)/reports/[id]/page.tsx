import { notFound, redirect } from "next/navigation";

import { ReportEditor } from "@/components/reports/ReportEditor";
import { fetchReportDetail } from "@/server/repositories/reports";
import { getCurrentUser } from "@/server/session";

const monthFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const report = await fetchReportDetail(user, id);
  if (!report) {
    notFound();
  }

  return (
    <section className="space-y-6 p-6">
      <a href="/reports" className="text-sm text-brand underline">← 보고서 목록</a>

      <div>
        <p className="text-sm font-semibold text-brand">{report.clientName}</p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">{report.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{monthFormatter.format(report.reportingMonth)}</p>
      </div>

      <div className="rounded-lg border border-line bg-white p-5">
        <ReportEditor report={{ id: report.id, status: report.status, metrics: report.metrics }} />
      </div>
    </section>
  );
}
