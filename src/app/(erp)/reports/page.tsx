import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ReportStatus } from "@/domain/types";
import { fetchReportsForUser, type ReportListItem } from "@/server/repositories/reports";
import { getCurrentUser } from "@/server/session";

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
  },
  {
    key: "actions",
    header: "관리",
    render: (report) => (
      <Link href={`/reports/${report.id}/edit`} className="text-sm font-medium text-brand hover:underline">
        수정/검토
      </Link>
    )
  }
];

export default async function ReportsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const reports = await fetchReportsForUser(user);
  const reviewNeeded = reports.filter((report) => report.status === ReportStatus.REVIEW_NEEDED).length;
  const delivered = reports.filter((report) => report.status === ReportStatus.DELIVERED).length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand">보고서</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">월간 보고서 및 성과 집계</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            거래처별 월간 보고서, 블로그 방문자수 등 성과 지표, 검토 상태와 전달 여부를 관리합니다.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Link
            href="/reports/new"
            className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90"
          >
            새 보고서
          </Link>
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
      </div>

      <DataTable columns={columns} rows={reports} emptyMessage="조회 가능한 보고서가 없습니다." />
    </section>
  );
}
