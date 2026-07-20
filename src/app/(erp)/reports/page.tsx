import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { CreateReportForm } from "@/components/reports/CreateReportForm";
import { GenerateMonthlyReport } from "@/components/reports/GenerateMonthlyReport";
import { TemplateFiller } from "@/components/settings/TemplateFiller";
import { ReportStatus } from "@/domain/types";
import { fetchReportsForUser, type ReportListItem } from "@/server/repositories/reports";
import { listClientsForUser } from "@/server/repositories/clients";
import { listTemplatesForUse } from "@/server/repositories/document-templates";
import { getCurrentUser } from "@/server/session";

// 결재 서류 유형 — 이용자가 필요한 결재 서류를 골라 작성.
const DOC_TYPES = [
  { key: "monthly", label: "월간 보고서", desc: "거래처 월간 성과 리포트", href: "#monthly" },
  { key: "weekly", label: "주간보고", desc: "여러 보고서 선택 작성", href: "/weekly" },
  { key: "leave", label: "연차·휴가 신청", desc: "휴가·연차 결재", href: "/leave" },
  { key: "form", label: "서식 발급", desc: "근로계약·재직증명 등", href: "#forms" }
] as const;

const monthFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });
const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });

const reportStatusLabels: Record<ReportStatus, string> = {
  [ReportStatus.DRAFT]: "작성중",
  [ReportStatus.REVIEW_NEEDED]: "검토필요",
  [ReportStatus.APPROVED]: "승인",
  [ReportStatus.DELIVERED]: "전달완료"
};

function fileNameFromUrl(url: string | null) {
  if (!url) return "-";
  return url.split("/").pop() ?? url;
}

const columns: DataTableColumn<ReportListItem>[] = [
  {
    key: "title",
    header: "보고서",
    render: (report) => (
      <div>
        <p className="font-medium text-ink">{report.title}</p>
        <p className="mt-1 text-xs text-slate-500">{monthFormatter.format(report.reportingMonth)}</p>
      </div>
    )
  },
  {
    key: "client",
    header: "거래처",
    render: (report) => report.clientName
  },
  {
    key: "owner",
    header: "작성/검토",
    render: (report) => (
      <div>
        <p>{report.authorName}</p>
        <p className="mt-1 text-xs text-slate-500">{report.reviewerName ?? "검토자 미배정"}</p>
      </div>
    )
  },
  {
    key: "metrics",
    header: "성과 요약",
    render: (report) => <span className="line-clamp-2 text-slate-600">{report.metricsSummary}</span>
  },
  {
    key: "attachment",
    header: "첨부",
    render: (report) => fileNameFromUrl(report.attachmentUrl)
  },
  {
    key: "status",
    header: "상태",
    render: (report) => <span className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-slate-700">{reportStatusLabels[report.status]}</span>
  },
  {
    key: "dates",
    header: "검토/전달",
    render: (report) => (
      <div className="text-xs text-slate-500">
        <p>검토 {report.reviewedAt ? dateFormatter.format(report.reviewedAt) : "-"}</p>
        <p className="mt-1">전달 {report.deliveredAt ? dateFormatter.format(report.deliveredAt) : "-"}</p>
      </div>
    )
  }
];

export default async function ReportsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [reports, clientRows, usableTemplates] = await Promise.all([
    fetchReportsForUser(user),
    listClientsForUser(user),
    listTemplatesForUse(["HR", "GENERAL"], user.role).catch(() => [])
  ]);
  const reviewNeeded = reports.filter((report) => report.status === ReportStatus.REVIEW_NEEDED).length;
  const delivered = reports.filter((report) => report.status === ReportStatus.DELIVERED).length;
  const clientOptions = clientRows.map((c) => ({ id: c.id, name: c.name }));

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <DashboardHeader
          eyebrow="결재"
          title="결재"
          description="필요한 결재 서류(월간 보고서·주간보고·연차/휴가·서식)를 골라 작성합니다. 상신하면 담당자→관리자→최고관리자 순으로 결재됩니다."
        />
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-md border border-line bg-white px-4 py-3">
            <p className="text-xs text-slate-500">전체</p>
            <p className="mt-1 font-semibold text-ink">{reports.length}</p>
          </div>
          <div className="rounded-md border border-line bg-white px-4 py-3">
            <p className="text-xs text-slate-500">검토</p>
            <p className="mt-1 font-semibold text-warning">{reviewNeeded}</p>
          </div>
          <div className="rounded-md border border-line bg-white px-4 py-3">
            <p className="text-xs text-slate-500">전달</p>
            <p className="mt-1 font-semibold text-brand">{delivered}</p>
          </div>
        </div>
      </div>

      {/* 결재 서류 선택 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DOC_TYPES.map((t) => (
          <Link
            key={t.key}
            href={t.href as Route}
            className="rounded-xl border border-line bg-card p-3 transition hover:border-brand hover:shadow-sm"
          >
            <p className="text-sm font-bold text-ink">{t.label}</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">{t.desc}</p>
          </Link>
        ))}
      </div>

      {/* 월간 보고서 */}
      <div id="monthly" className="space-y-4 scroll-mt-20">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">월간 보고서 · 거래처 GEO 주간 리포트를 규칙기반으로 조립합니다.</p>
          <Link
            href="/reports/geo-weekly"
            className="shrink-0 rounded-full border border-emerald-200 bg-card px-3.5 py-1.5 text-xs font-semibold text-emerald-700 hover:border-emerald-300 hover:text-emerald-800"
          >
            GEO 주간 리포트 →
          </Link>
        </div>
        <GenerateMonthlyReport clients={clientOptions} />
        <CreateReportForm clients={clientOptions} />
        <DataTable columns={columns} rows={reports} emptyMessage="조회 가능한 보고서가 없습니다." />
      </div>

      {/* 인사·일반 서식 발급 */}
      <div id="forms" className="space-y-3 scroll-mt-20">
        <h3 className="text-base font-semibold text-ink">서식 발급</h3>
        <p className="text-sm text-slate-500">근로계약서·재직증명서 등 서식을 골라 항목을 채우고 인쇄/PDF로 발급합니다.</p>
        <TemplateFiller templates={usableTemplates} />
      </div>
    </section>
  );
}
