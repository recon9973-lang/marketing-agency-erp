// 월간 보고서 초안 빌더 — 거래처·월의 계약/업무/콘텐츠/순위/GEO를 집계해 Report(DRAFT)로 upsert.
// 수동 생성 액션(generateMonthlyReport)과 자동 배치(runMonthlyReportDrafts)가 함께 쓰는 단일 소스.
// 인증·권한 검사는 호출부 책임(이 함수는 순수 집계+저장만).

import { db } from "@/server/db";
import { geoMonthlySummary } from "@/server/repositories/geo";

export type MonthlyReportStats = { completedWork: number; publishedContent: number; products: number };
export type BuildMonthlyReportResult = { id: string; created: boolean; stats: MonthlyReportStats };

/** reportingMonth: "YYYY-MM". 이미 있으면 metrics만 갱신(초안 유지), 없으면 생성. */
export async function buildMonthlyReportDraft(params: {
  clientId: string;
  clientName: string;
  reportingMonth: string;
  authorId: string;
}): Promise<BuildMonthlyReportResult> {
  const { clientId, clientName, reportingMonth, authorId } = params;

  const start = new Date(`${reportingMonth}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const [contractProducts, completedWork, publishedContent, rankRows, geo] = await Promise.all([
    db.contractProduct.findMany({ where: { contract: { clientId } }, select: { product: { select: { name: true } } } }),
    db.workItem.count({ where: { clientId, status: "COMPLETED", updatedAt: { gte: start, lt: end } } }),
    db.contentPlan.count({ where: { clientId, status: "PUBLISHED", month: reportingMonth } }),
    db.placeRankRecord.findMany({ where: { clientId, recordedOn: { gte: start, lt: end } }, orderBy: { recordedOn: "desc" }, select: { keyword: true, rank: true } }),
    geoMonthlySummary(clientId, start, end)
  ]);

  const products = [...new Set(contractProducts.map((cp) => cp.product.name))];
  // 키워드별 최신 순위(내림차순 정렬이라 첫 등장이 최신).
  const rankMap = new Map<string, number | null>();
  for (const r of rankRows) if (!rankMap.has(r.keyword)) rankMap.set(r.keyword, r.rank);
  const keywordRanks = [...rankMap.entries()].map(([keyword, rank]) => ({ keyword, rank }));

  const monthLabel = `${start.getUTCFullYear()}년 ${start.getUTCMonth() + 1}월`;
  const summary =
    `${clientName} ${monthLabel} 운영 요약: 계약 상품 ${products.length}종 운영, ` +
    `완료 업무 ${completedWork}건, 게시 콘텐츠 ${publishedContent}건` +
    (keywordRanks.length ? `, 순위 추적 ${keywordRanks.length}개 키워드` : "") +
    (geo.checks > 0 ? `, AI답변 관측 ${geo.checks}회(질문 ${geo.monitoredQuestions}개 중 출현 ${geo.appearedQuestions}개).` : ".");

  const metrics = {
    summary,
    "계약 상품": products.join(", ") || "-",
    "완료 업무": `${completedWork}건`,
    "게시 콘텐츠": `${publishedContent}건`,
    keywordRanks,
    // GEO 모니터링(§13) — 노출 보장 지표가 아닌 관측 지표. 리포트에 고지 문구 필수.
    ...(geo.checks > 0
      ? {
          geo: {
            ...geo,
            disclaimer: "AI 답변 출현은 보장 지표가 아닌 모니터링 지표이며, 엔진 정책에 따라 수시로 변동될 수 있습니다."
          }
        }
      : {})
  };

  const existing = await db.report.findUnique({
    where: { clientId_reportingMonth: { clientId, reportingMonth: start } },
    select: { id: true }
  });

  const rep = await db.report.upsert({
    where: { clientId_reportingMonth: { clientId, reportingMonth: start } },
    create: { clientId, authorId, reportingMonth: start, title: `${clientName} ${monthLabel} 월간보고서`, status: "DRAFT", metrics },
    update: { metrics, status: "DRAFT" } // 작성자·검토상태는 유지(초안 갱신만)
  });

  return { id: rep.id, created: !existing, stats: { completedWork, publishedContent, products: products.length } };
}
