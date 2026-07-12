// 목표 경로: src/server/repositories/geo.ts
//
// GEO 모니터링 조회 — 질문×엔진 매트릭스(질문별 엔진별 최신 관측) + 월별 출현 요약.
// 규모 상한(질문 ≤ 수십 × 엔진 5)이라 조인 후 메모리 축약으로 충분(패널 결정 #6).
import { GEO_ENGINES, type GeoEngine } from "@/domain/sales/geo";
import { db } from "@/server/db";

export type GeoCell = {
  appeared: boolean;
  cited: boolean;
  checkedOn: string;
  snippet: string | null;
  evidenceUrl: string | null;
};

export type GeoQuestionRow = {
  id: string;
  question: string;
  department: string | null;
  qtype: string | null;
  priority: number;
  status: string;
  targetPageUrl: string | null;
  answerPlanId: string | null;
  approvedAt: string | null;
  cells: Partial<Record<GeoEngine, GeoCell>>;
};

export async function listGeoMatrix(clientId: string): Promise<GeoQuestionRow[]> {
  const questions = await db.geoQuestion.findMany({
    where: { clientId },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    include: {
      answerRecords: {
        orderBy: { checkedOn: "desc" },
        take: GEO_ENGINES.length * 12 // 엔진당 최근 관측 여유분
      }
    }
  });

  const rows = questions.map((q) => {
    const cells: Partial<Record<GeoEngine, GeoCell>> = {};
    for (const rec of q.answerRecords) {
      const engine = rec.engine as GeoEngine;
      if (cells[engine]) continue; // desc 정렬 — 첫 건이 최신
      cells[engine] = {
        appeared: rec.appeared,
        cited: rec.cited,
        checkedOn: rec.checkedOn.toISOString().slice(0, 10),
        snippet: rec.snippet,
        evidenceUrl: rec.evidenceUrl
      };
    }
    return {
      id: q.id,
      question: q.question,
      department: q.department,
      qtype: q.qtype,
      priority: q.priority,
      status: q.status,
      targetPageUrl: q.targetPageUrl,
      answerPlanId: q.answerPlanId,
      approvedAt: q.approvedAt?.toISOString() ?? null,
      cells
    };
  });
  // 종료(RETIRED) 질문은 맨 뒤 — 복원(오조작 복구)용으로만 노출
  return rows.sort((a, b) => Number(a.status === "RETIRED") - Number(b.status === "RETIRED"));
}

export type GeoSummary = {
  totalQuestions: number;
  candidateCount: number;
  monitoredCount: number;
  appearedCount: number; // 최신 관측 기준 1개 이상 엔진에서 출현한 질문 수
  citedCount: number;
};

export type GeoMonthlySummary = {
  monitoredQuestions: number; // 해당 월에 1회 이상 관측된 질문 수
  checks: number; // 관측 기록 수
  appearedQuestions: number; // 출현(병원 언급)이 확인된 질문 수
  citedQuestions: number; // 공식 URL 인용이 확인된 질문 수
  byEngine: Partial<Record<GeoEngine, { checks: number; appeared: number }>>;
  evidenceCount: number; // 캡처/증빙 링크가 남은 기록 수
};

/** 월간 리포트용 GEO 집계(§13) — 해당 월 관측 기록 기준. 보장 지표가 아닌 모니터링 지표. */
export async function geoMonthlySummary(clientId: string, start: Date, end: Date): Promise<GeoMonthlySummary> {
  const records = await db.geoAnswerRecord.findMany({
    where: { question: { clientId }, checkedOn: { gte: start, lt: end } },
    select: { questionId: true, engine: true, appeared: true, cited: true, evidenceUrl: true }
  });

  const questions = new Set<string>();
  const appearedQ = new Set<string>();
  const citedQ = new Set<string>();
  const byEngine: GeoMonthlySummary["byEngine"] = {};
  let evidenceCount = 0;

  for (const r of records) {
    questions.add(r.questionId);
    if (r.appeared) appearedQ.add(r.questionId);
    if (r.cited) citedQ.add(r.questionId);
    if (r.evidenceUrl) evidenceCount++;
    const engine = r.engine as GeoEngine;
    const slot = (byEngine[engine] ??= { checks: 0, appeared: 0 });
    slot.checks++;
    if (r.appeared) slot.appeared++;
  }

  return {
    monitoredQuestions: questions.size,
    checks: records.length,
    appearedQuestions: appearedQ.size,
    citedQuestions: citedQ.size,
    byEngine,
    evidenceCount
  };
}

export type GeoTrendPoint = { month: string; monitored: number; appeared: number; rate: number };

/** 최근 N개월 월별 출현 추이 — (관측 질문 대비 출현 질문 비율). 관측 없던 달은 생략. */
export async function geoMonthlyTrend(clientId: string, months = 6): Promise<GeoTrendPoint[]> {
  const from = new Date();
  from.setUTCDate(1);
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCMonth(from.getUTCMonth() - (months - 1));

  const records = await db.geoAnswerRecord.findMany({
    where: { question: { clientId }, checkedOn: { gte: from } },
    select: { questionId: true, appeared: true, checkedOn: true }
  });

  const byMonth = new Map<string, { monitored: Set<string>; appeared: Set<string> }>();
  for (const r of records) {
    const month = r.checkedOn.toISOString().slice(0, 7);
    const slot = byMonth.get(month) ?? { monitored: new Set<string>(), appeared: new Set<string>() };
    slot.monitored.add(r.questionId);
    if (r.appeared) slot.appeared.add(r.questionId);
    byMonth.set(month, slot);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, s]) => ({
      month,
      monitored: s.monitored.size,
      appeared: s.appeared.size,
      rate: s.monitored.size > 0 ? Math.round((s.appeared.size / s.monitored.size) * 100) : 0
    }));
}

export type GeoDashboardSummary = {
  monitoredQuestions: number; // 승인·모니터링 중 질문 수(접근 가능 거래처 전체)
  appearedRecent: number; // 최근 30일 출현이 확인된 질문 수
  citedRecent: number; // 최근 30일 공식 URL 인용이 확인된 질문 수
  answerDrafts: number; // 답변 페이지 초안이 생성된 질문 수
};

/** 대시보드용 GEO 전체 요약 — 접근 가능한 거래처들의 실행 현황을 한 줄로. */
export async function geoDashboardSummary(clientIds: string[]): Promise<GeoDashboardSummary> {
  if (clientIds.length === 0) {
    return { monitoredQuestions: 0, appearedRecent: 0, citedRecent: 0, answerDrafts: 0 };
  }
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const [monitoredQuestions, answerDrafts, recent] = await Promise.all([
    db.geoQuestion.count({ where: { clientId: { in: clientIds }, status: { in: ["APPROVED", "MONITORING"] } } }),
    db.geoQuestion.count({ where: { clientId: { in: clientIds }, answerPlanId: { not: null } } }),
    db.geoAnswerRecord.findMany({
      where: { question: { clientId: { in: clientIds } }, checkedOn: { gte: since } },
      select: { questionId: true, appeared: true, cited: true }
    })
  ]);

  const appearedQ = new Set<string>();
  const citedQ = new Set<string>();
  for (const r of recent) {
    if (r.appeared) appearedQ.add(r.questionId);
    if (r.cited) citedQ.add(r.questionId);
  }
  return { monitoredQuestions, appearedRecent: appearedQ.size, citedRecent: citedQ.size, answerDrafts };
}

export function summarizeGeoMatrix(allRows: GeoQuestionRow[]): GeoSummary {
  const rows = allRows.filter((r) => r.status !== "RETIRED"); // 종료 질문은 지표에서 제외
  const monitored = rows.filter((r) => Object.keys(r.cells).length > 0);
  return {
    totalQuestions: rows.length,
    candidateCount: rows.filter((r) => r.status === "CANDIDATE").length,
    monitoredCount: monitored.length,
    appearedCount: monitored.filter((r) => Object.values(r.cells).some((c) => c?.appeared)).length,
    citedCount: monitored.filter((r) => Object.values(r.cells).some((c) => c?.cited)).length
  };
}