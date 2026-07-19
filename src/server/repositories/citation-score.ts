// GEO 언급률 시계열 조회 + 스냅샷 재계산 (GEO 모듈 설계 §2).
// - getMentionRateSeries: B1(전체 언급률 일별) 그래프 데이터 — 원천에서 즉시 파생(견고).
// - recomputeCitationScores: GeoCitationScore 스냅샷을 멱등 재계산(리포트·대시보드 캐시).
// - getGuardedRankSeries: C1(월보장 순위 일별) 그래프 데이터 — ExposureSnapshot에서 파생.
import { db } from "@/server/db";
import { dailyMentionSeries, type MentionRatePoint, type DatedCell } from "@/server/geo-studio/citation";

/** B1 데이터 — 거래처 전체 언급률 일별 시계열(최근 N일). 원천 GeoAnswerRecord에서 파생. */
export async function getMentionRateSeries(clientId: string, days = 120): Promise<MentionRatePoint[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const records = await db.geoAnswerRecord.findMany({
    where: { question: { clientId }, checkedOn: { gte: since } },
    select: { checkedOn: true, engine: true, appeared: true }
  });
  const cells: DatedCell[] = records.map((r) => ({
    checkedOn: r.checkedOn.toISOString().slice(0, 10),
    engine: r.engine,
    appeared: r.appeared
  }));
  return dailyMentionSeries(cells);
}

/**
 * GeoCitationScore 스냅샷 재계산(거래처 전체, 일별). 멱등: [clientId, questionId=null, runAt] upsert.
 * 관측 기록·크론이 호출. 그래프는 원천 파생을 쓰므로 이 표가 비어도 화면은 정상(리포트·조회 최적화용).
 */
export async function recomputeCitationScores(clientId: string, days = 120): Promise<number> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const records = await db.geoAnswerRecord.findMany({
    where: { question: { clientId }, checkedOn: { gte: since } },
    select: { checkedOn: true, engine: true, appeared: true, cited: true, rank: true }
  });
  if (records.length === 0) return 0;

  // 날짜별 집계(엔진 단위 셀). 전체 집계라 같은 엔진이 여러 질문에 걸쳐 등장 → 셀 합산.
  const byDate = new Map<
    string,
    { total: number; mentioned: number; cited: number; ranks: number[]; byEngine: Record<string, { m: number; c: number; t: number }> }
  >();
  for (const r of records) {
    const key = r.checkedOn.toISOString().slice(0, 10);
    const slot = byDate.get(key) ?? { total: 0, mentioned: 0, cited: 0, ranks: [], byEngine: {} };
    slot.total += 1;
    if (r.appeared) slot.mentioned += 1;
    if (r.cited) slot.cited += 1;
    if (r.appeared && typeof r.rank === "number") slot.ranks.push(r.rank);
    const e = (slot.byEngine[r.engine] ??= { m: 0, c: 0, t: 0 });
    e.t += 1;
    if (r.appeared) e.m += 1;
    if (r.cited) e.c += 1;
    byDate.set(key, slot);
  }

  // 전체(questionId=null) 스냅샷은 Postgres에서 null이 unique로 구분되지 않으므로
  // 범위 삭제 후 재삽입으로 멱등 처리(중복 방지). 대상 날짜 집합만 정확히 교체.
  const runAts = [...byDate.keys()].map((d) => new Date(`${d}T00:00:00.000Z`));
  const data = [...byDate.entries()].map(([date, s]) => {
    const avgRank = s.ranks.length ? Math.round((s.ranks.reduce((a, b) => a + b, 0) / s.ranks.length) * 10) / 10 : null;
    return {
      clientId,
      questionId: null,
      runAt: new Date(`${date}T00:00:00.000Z`),
      totalModels: s.total,
      mentionedModels: s.mentioned,
      mentionRate: s.total > 0 ? s.mentioned / s.total : 0,
      avgRank,
      citedModels: s.cited,
      byEngine: s.byEngine
    };
  });

  await db.$transaction([
    db.geoCitationScore.deleteMany({ where: { clientId, questionId: null, runAt: { in: runAts } } }),
    db.geoCitationScore.createMany({ data })
  ]);
  return data.length;
}

export type GuardedRankSeries = {
  keyword: string;
  channel: string;
  targetRank: number | null;
  points: { date: string; rank: number | null }[];
};

/** C1 데이터 — 월보장 키워드별 일별 순위 시계열(최근 N일). ExposureSnapshot에서 파생. */
export async function getGuardedRankSeries(clientId: string, days = 90): Promise<GuardedRankSeries[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const keywords = await db.keyword.findMany({
    where: { clientId, isGuaranteed: true },
    select: {
      keyword: true,
      targetRank: true,
      guardChannel: true,
      snapshots: {
        where: { checkedOn: { gte: since } },
        orderBy: { checkedOn: "asc" },
        select: { channel: true, rank: true, checkedOn: true }
      }
    }
  });

  return keywords.map((k) => {
    // 보장 채널 우선, 없으면 스냅샷에 존재하는 첫 채널.
    const channel = k.guardChannel ?? k.snapshots[0]?.channel ?? "blog";
    const points = k.snapshots
      .filter((s) => s.channel === channel)
      .map((s) => ({ date: s.checkedOn.toISOString().slice(0, 10), rank: s.rank }));
    return { keyword: k.keyword, channel, targetRank: k.targetRank, points };
  });
}

// ── G3 시각화 데이터 ───────────────────────────────────────────────

export type EngineRadar = {
  engines: { engine: string; before: number; now: number }[]; // 0~100
  beforeDate: string | null;
  nowDate: string | null;
};

/** B2 데이터 — 엔진별 언급률(첫 관측일 vs 최신 관측일). 엔진×일자 셀 비율로 산출. */
export async function getEngineRadar(clientId: string, days = 180): Promise<EngineRadar> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const records = await db.geoAnswerRecord.findMany({
    where: { question: { clientId }, checkedOn: { gte: since } },
    select: { engine: true, appeared: true, checkedOn: true }
  });
  if (records.length === 0) return { engines: [], beforeDate: null, nowDate: null };

  const dates = [...new Set(records.map((r) => r.checkedOn.toISOString().slice(0, 10)))].sort();
  const beforeDate = dates[0];
  const nowDate = dates[dates.length - 1];
  const engineSet = [...new Set(records.map((r) => r.engine))];

  function rateOn(date: string, engine: string): number {
    const cells = records.filter((r) => r.engine === engine && r.checkedOn.toISOString().slice(0, 10) === date);
    if (cells.length === 0) return 0;
    return Math.round((cells.filter((c) => c.appeared).length / cells.length) * 100);
  }

  const engines = engineSet.map((engine) => ({
    engine,
    before: rateOn(beforeDate, engine),
    now: rateOn(nowDate, engine)
  }));
  return { engines, beforeDate, nowDate };
}

export type StandingRow = { name: string; rate: number; models: number; avgRank: number | null; isUs: boolean };

/**
 * B4 데이터 — 언급 현황(우리 + 경쟁사 랭킹). 질문×엔진 최신 셀 기준.
 * 우리: 언급 셀 비율·언급 엔진수·평균순위. 경쟁사: 언급 셀 비율·엔진수(순위 데이터 없음 → null).
 */
export async function getMentionStanding(clientId: string, usName: string, days = 180): Promise<StandingRow[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const records = await db.geoAnswerRecord.findMany({
    where: { question: { clientId }, checkedOn: { gte: since } },
    orderBy: { checkedOn: "desc" },
    select: { questionId: true, engine: true, appeared: true, rank: true, competitorsMentioned: true, checkedOn: true }
  });
  if (records.length === 0) return [];

  // 질문×엔진 최신 셀만(desc 정렬 → 첫 건).
  const seen = new Set<string>();
  const cells = records.filter((r) => {
    const key = `${r.questionId}|${r.engine}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const total = cells.length;
  if (total === 0) return [];

  // 우리
  const usCells = cells.filter((c) => c.appeared);
  const usModels = new Set(usCells.map((c) => c.engine));
  const usRanks = usCells.map((c) => c.rank).filter((r): r is number => typeof r === "number");
  const us: StandingRow = {
    name: usName || "우리 병원",
    rate: Math.round((usCells.length / total) * 100),
    models: usModels.size,
    avgRank: usRanks.length ? Math.round((usRanks.reduce((a, b) => a + b, 0) / usRanks.length) * 10) / 10 : null,
    isUs: true
  };

  // 경쟁사 집계
  const comp = new Map<string, { cells: number; engines: Set<string> }>();
  for (const c of cells) {
    const names = Array.isArray(c.competitorsMentioned) ? (c.competitorsMentioned as unknown[]) : [];
    for (const raw of names) {
      const name = String(raw).trim();
      if (!name) continue;
      const slot = comp.get(name) ?? { cells: 0, engines: new Set<string>() };
      slot.cells += 1;
      slot.engines.add(c.engine);
      comp.set(name, slot);
    }
  }
  const competitors: StandingRow[] = [...comp.entries()]
    .map(([name, s]) => ({ name, rate: Math.round((s.cells / total) * 100), models: s.engines.size, avgRank: null, isUs: false }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 8);

  return [us, ...competitors].sort((a, b) => b.rate - a.rate);
}

export type QuestionMentionSeries = {
  dates: string[]; // 공통 x축(관측일)
  questions: { label: string; points: (number | null)[] }[]; // 질문별 언급률(%) 시계열
};

/** B3 데이터 — 질문별 언급률 추이(멀티라인). 상위 우선순위 질문 최대 6개. */
export async function getQuestionMentionSeries(clientId: string, days = 180, maxQuestions = 6): Promise<QuestionMentionSeries> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const questions = await db.geoQuestion.findMany({
    where: { clientId, status: { not: "RETIRED" } },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    take: maxQuestions,
    select: {
      question: true,
      answerRecords: {
        where: { checkedOn: { gte: since } },
        select: { engine: true, appeared: true, checkedOn: true }
      }
    }
  });

  const allDates = new Set<string>();
  const perQ = questions.map((q) => {
    const byDate = new Map<string, { total: number; mentioned: number }>();
    for (const r of q.answerRecords) {
      const d = r.checkedOn.toISOString().slice(0, 10);
      allDates.add(d);
      const slot = byDate.get(d) ?? { total: 0, mentioned: 0 };
      slot.total += 1;
      if (r.appeared) slot.mentioned += 1;
      byDate.set(d, slot);
    }
    return { label: q.question, byDate };
  });

  const dates = [...allDates].sort();
  const questionsOut = perQ.map((q) => ({
    label: q.label,
    points: dates.map((d) => {
      const s = q.byDate.get(d);
      return s && s.total > 0 ? Math.round((s.mentioned / s.total) * 100) : null;
    })
  }));
  return { dates, questions: questionsOut };
}
