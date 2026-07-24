"use server";

/**
 * 마케팅 상담 진단 액션 — 진행 중 거래처의 실측 신호를 모아 종합 진단·대응 방향을 합성.
 * 소스: insights 리포지토리(채널·순위·키워드) + 상권 엔진(스코어카드·경쟁·소득·접근) + WorkItem(실행).
 * 신호가 없는 영역은 nodata 로 정직 강등(consulting-review 합성 규칙).
 */
import { runAction, type ActionResult } from "@/server/action-result";
import { requireUser } from "@/server/actions/_helpers";
import { db } from "@/server/db";
import { getClientInsight, type ChannelSeries } from "@/server/repositories/insights";
import {
  getLocationInsight,
  getOpenings,
  nationalHospitalsPerTenThousand,
  getRegionIncome,
  getRegionAccess
} from "@/server/data/region-insight";
import { buildScorecard } from "@/server/market/scorecard";
import {
  buildConsultingReview,
  consultingReviewMarkdown,
  type ConsultingReview,
  type ReviewInput
} from "@/server/market/consulting-review";

/** 여러 채널 시계열을 날짜별로 합산해 최근/초기 비율(추세)을 낸다. 데이터 부족 시 null. */
function seriesTrend(series: ChannelSeries[]): number | null {
  const byDate = new Map<string, number>();
  for (const s of series) for (const p of s.points) byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.value);
  const dates = [...byDate.keys()].sort();
  if (dates.length < 2) return null;
  const first = byDate.get(dates[0]) ?? 0;
  const last = byDate.get(dates[dates.length - 1]) ?? 0;
  return first > 0 ? Math.round((last / first) * 100) / 100 : null;
}

export type ClientReviewResult = {
  review: ConsultingReview;
  markdown: string;
  region: string;
  departments: string[];
};

/** 거래처 마케팅 상담 진단(현황 종합 + 대응 방향). 로그인 직원 누구나(담당 범위는 insights 가 검증). */
export async function getClientConsultingReview(clientId: string): Promise<ActionResult<ClientReviewResult>> {
  return runAction(async (): Promise<ClientReviewResult> => {
    const user = await requireUser();
    const client = await db.client.findUnique({ where: { id: clientId }, select: { name: true, region: true } });
    if (!client) throw new Error("거래처를 찾을 수 없습니다.");
    const profile = await db.hospitalProfile
      .findUnique({ where: { clientId }, select: { departments: true } })
      .catch(() => null);
    const departments = (profile?.departments ?? "")
      .split(/[,\n·]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const insight = await getClientInsight(user, clientId).catch(() => null);

    // 상권·경쟁 신호(상권 엔진, 결정형)
    const region = client.region ?? "";
    const loc = region ? getLocationInsight(region) : null;
    const nationalPer = nationalHospitalsPerTenThousand();
    const key = loc?.resolve.key ?? null;
    const scorecard = key
      ? buildScorecard({ population: loc!.population, hospitals: loc!.hospitals, openings: getOpenings(key), nationalPer })
      : null;
    const openings = key ? getOpenings(key) : null;
    const income = key ? getRegionIncome(key.split("|")[0]) : null;
    const access = key ? getRegionAccess(key) : null;

    // 실행 현황(WorkItem 집계)
    const now = new Date();
    const [grouped, overdue] = await Promise.all([
      db.workItem
        .groupBy({ by: ["status"], where: { clientId }, _count: { _all: true } })
        .catch(() => [] as { status: string; _count: { _all: number } }[]),
      db.workItem.count({ where: { clientId, dueDate: { lt: now }, status: { notIn: ["COMPLETED"] } } }).catch(() => 0)
    ]);
    let work: ReviewInput["work"] = null;
    if (grouped.length) {
      const cnt = (s: string[]) => grouped.filter((g) => s.includes(g.status)).reduce((a, g) => a + g._count._all, 0);
      const total = grouped.reduce((a, g) => a + g._count._all, 0);
      work = {
        total,
        completed: cnt(["COMPLETED"]),
        active: cnt(["IN_PROGRESS", "REVIEW_NEEDED", "CLIENT_APPROVAL", "WAITING"]),
        blocked: cnt(["BLOCKED"]),
        overdue
      };
    }

    // insights 스칼라 정규화
    const rankLatest = insight ? insight.rankSeries.map((r) => r.latest).filter((v): v is number => v != null) : [];
    const rankDeltas = insight ? insight.rankSeries.map((r) => r.delta).filter((v): v is number => v != null) : [];
    const inp: ReviewInput = {
      hospitalName: client.name,
      region,
      departments,
      hasChannelData: insight?.hasChannelData ?? false,
      hasRankData: insight?.hasRankData ?? false,
      totalImpressions: insight?.kpis.totalImpressions ?? 0,
      totalVisitors: insight
        ? insight.kpis.placeVisitors + insight.kpis.blogVisitors + insight.kpis.homepageVisitors
        : 0,
      impressionTrend: insight ? seriesTrend(insight.impressionSeries) : null,
      visitorTrend: insight ? seriesTrend(insight.visitorSeries) : null,
      rankAvg: rankLatest.length ? Math.round((rankLatest.reduce((a, b) => a + b, 0) / rankLatest.length) * 10) / 10 : null,
      rankNetDelta: rankDeltas.length ? rankDeltas.reduce((a, b) => a + b, 0) : null,
      trackedKeywords: insight?.kpis.trackedKeywords ?? 0,
      coreKeywordCount: insight?.coreKeywords.length ?? 0,
      relatedCount: insight?.relatedKeywords.length ?? 0,
      scoreGrade: scorecard?.grade ?? null,
      scoreOverall: scorecard?.overall ?? null,
      competitionPer: loc?.hospitals?.perTenThousand ?? null,
      nationalPer,
      openingsY1: openings?.y1 ?? null,
      incomeIndex: income?.index ?? null,
      accessLabel: access?.label ?? null,
      work
    };

    const review = buildConsultingReview(inp);
    const markdown = consultingReviewMarkdown(review, {
      region: loc?.resolve.label || region || "지역 미상",
      departments,
      date: now.toISOString().slice(0, 10)
    });
    return { review, markdown, region: loc?.resolve.label || region, departments };
  });
}
