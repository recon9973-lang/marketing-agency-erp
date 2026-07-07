// 보고서 상세/편집 페이지 — 지표 입력 + 상태전이 + PDF 다운로드(ReportEditor).
import { notFound } from "next/navigation";
import { ReportEditor } from "@/components/reports/ReportEditor";
import { canAccessClient } from "@/domain/access-control";
import { Role } from "@/domain/types";
import { db } from "@/server/db";
import { getAdminScopes } from "@/server/actions/_helpers";
import { getCurrentUser } from "@/server/session";

const monthFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const report = await db.report.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true, assignedMarketerId: true } } }
  });
  if (!report) notFound();

  // 권한: 거래처 접근 범위 기준 (마케터=본인 배정, 관리자=범위, 최고관리자=전체)
  const scopes = user.role === Role.ADMIN ? await getAdminScopes(user) : [];
  if (!canAccessClient(user, report.client.id, scopes, report.client.assignedMarketerId)) notFound();

  return (
    <section className="space-y-6 p-6">
      <div>
        <p className="text-sm font-semibold text-brand">보고서</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">{report.title}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {report.client.name} · {monthFormatter.format(report.reportingMonth)}
        </p>
      </div>
      <ReportEditor
        report={{
          id: report.id,
          status: report.status,
          metrics: (report.metrics ?? null) as Record<string, unknown> | null
        }}
      />
    </section>
  );
}
