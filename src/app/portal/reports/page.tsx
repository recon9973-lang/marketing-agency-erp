// src/app/(portal)/reports/page.tsx
// 거래처 보고서 목록



import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import Link from "next/link";
import { ReportStatus } from "@prisma/client";

const STATUS_LABELS: Record<ReportStatus, string> = {
  DRAFT: "작성 중",
  REVIEW_NEEDED: "검토 중",
  APPROVED: "승인됨",
  DELIVERED: "전달 완료",
};

const STATUS_STYLES: Record<ReportStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-500",
  REVIEW_NEEDED: "bg-amber-50 text-amber-700 border border-amber-200",
  APPROVED: "bg-sky-50 text-sky-700 border border-sky-200",
  DELIVERED: "bg-green-50 text-green-700 border border-green-200",
};

export default async function PortalReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id! },
    select: { clientId: true },
  });
  if (!user?.clientId) redirect("/portal/dashboard");

  const reports = await db.report.findMany({
    where: { clientId: user.clientId },
    orderBy: { reportingMonth: "desc" },
    select: {
      id: true,
      title: true,
      reportingMonth: true,
      status: true,
      deliveredAt: true,
      metrics: true,
      author: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">보고서</h1>
        <p className="text-sm text-slate-400 mt-1">
          월간 마케팅 성과 보고서 목록입니다.
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-3xl mb-3">📊</p>
          <p className="text-slate-500 text-sm">아직 보고서가 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {reports.map((r) => {
            const metrics = r.metrics as Record<string, unknown> | null;
            const avgRank =
              (metrics?.assembled as Record<string, unknown> | null)
                ?.avgRank ?? null;
            const rankedCount =
              (metrics?.assembled as Record<string, unknown> | null)
                ?.rankedCount ?? null;

            return (
              <Link
                key={r.id}
                href={`/portal/reports/${r.id}`}
                className="block bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md hover:border-sky-100 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          STATUS_STYLES[r.status]
                        }`}
                      >
                        {STATUS_LABELS[r.status]}
                      </span>
                      {r.deliveredAt && (
                        <span className="text-xs text-slate-400">
                          전달:{" "}
                          {new Date(r.deliveredAt).toLocaleDateString("ko-KR")}
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-semibold text-slate-800">
                      {r.title}
                    </h2>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {new Date(r.reportingMonth).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                      })}{" "}
                      · 작성: {r.author.name}
                    </p>
                  </div>

                  {/* 성과 미리보기 */}
                  {avgRank != null && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400">평균 키워드 순위</p>
                      <p className="text-2xl font-bold text-sky-600">
                        {String(avgRank)}위
                      </p>
                      {rankedCount != null && (
                        <p className="text-xs text-slate-400">
                          {String(rankedCount)}개 키워드 노출
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
