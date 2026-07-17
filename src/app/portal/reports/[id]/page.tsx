// src/app/(portal)/reports/[id]/page.tsx
// 보고서 상세 뷰 — 클라이언트 포털



import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import Link from "next/link";
import { CommentSection } from "@/components/portal/CommentSection";

export default async function PortalReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id! },
    select: { clientId: true, name: true },
  });
  if (!user?.clientId) redirect("/portal/dashboard");

  const report = await db.report.findUnique({
    where: { id },
    include: {
      author: { select: { name: true, email: true } },
      reviewer: { select: { name: true } },
    },
  });

  // 접근 제어: 자기 거래처 보고서만
  if (!report || report.clientId !== user.clientId) notFound();

  const metrics = report.metrics as Record<string, unknown> | null;
  const assembled = (metrics?.assembled as Record<string, unknown>) ?? null;
  const keywordRanks = Array.isArray(metrics?.keywordRanks)
    ? (metrics.keywordRanks as { keyword: string; rank: number | null; checkedAt?: string }[])
    : [];
  const summaryText = (metrics?.summary as string) ?? null;

  // 댓글 로드
  const comments = await db.clientComment.findMany({
    where: { reportId: report.id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, role: true } } },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      {/* 뒤로 */}
      <Link
        href="/portal/reports"
        className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1"
      >
        ← 보고서 목록
      </Link>

      {/* 헤더 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-slate-400 mb-1">
              {new Date(report.reportingMonth).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
              })}{" "}
              · {report.author.name}
              {report.reviewer && ` · 검토: ${report.reviewer.name}`}
            </p>
            <h1 className="text-xl font-bold text-slate-800">{report.title}</h1>
            {report.deliveredAt && (
              <p className="text-xs text-green-600 mt-1">
                ✅ {new Date(report.deliveredAt).toLocaleDateString("ko-KR")} 전달 완료
              </p>
            )}
          </div>
          {/* PDF 다운로드 */}
          <a
            href={`/api/reports/${report.id}/pdf`}
            target="_blank"
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            📥 PDF 다운로드
          </a>
        </div>

        {/* 요약 텍스트 */}
        {summaryText && (
          <div className="mt-4 p-4 bg-sky-50 rounded-xl text-sm text-sky-800 leading-relaxed">
            {summaryText}
          </div>
        )}
      </div>

      {/* 키워드 성과 */}
      {keywordRanks.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h2 className="text-sm font-bold text-slate-700 mb-4">
            키워드 순위 현황
          </h2>

          {/* 집계 지표 */}
          {assembled && (
            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                {
                  label: "평균 순위",
                  value: assembled.avgRank != null ? `${assembled.avgRank}위` : "—",
                },
                {
                  label: "노출 키워드",
                  value: `${assembled.rankedCount ?? 0}개`,
                },
                {
                  label: "전월 대비 상승",
                  value: Array.isArray(assembled.improved)
                    ? `${(assembled.improved as unknown[]).length}개`
                    : "—",
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className="text-center p-3 bg-slate-50 rounded-xl"
                >
                  <p className="text-xs text-slate-400 mb-1">{m.label}</p>
                  <p className="text-lg font-bold text-slate-800">{m.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* 키워드 테이블 */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs text-slate-400 font-medium pb-2">
                  키워드
                </th>
                <th className="text-right text-xs text-slate-400 font-medium pb-2">
                  순위
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {keywordRanks.map((kw) => (
                <tr key={kw.keyword}>
                  <td className="py-2 text-slate-700">{kw.keyword}</td>
                  <td className="py-2 text-right">
                    {kw.rank != null ? (
                      <span
                        className={`font-semibold ${
                          kw.rank <= 3
                            ? "text-green-600"
                            : kw.rank <= 10
                            ? "text-sky-600"
                            : "text-slate-400"
                        }`}
                      >
                        {kw.rank}위
                      </span>
                    ) : (
                      <span className="text-slate-300">미노출</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 비고 */}
      {report.notes && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h2 className="text-sm font-bold text-slate-700 mb-3">담당자 메모</h2>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {report.notes}
          </p>
        </div>
      )}

      {/* 댓글 섹션 */}
      <CommentSection
        reportId={report.id}
        currentUserId={session.user.id}
        currentUserName={user.name}
        comments={comments.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          author: {
            id: c.author.id,
            name: c.author.name,
            role: c.author.role as string,
          },
        }))}
      />
    </div>
  );
}
