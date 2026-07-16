// src/server/marketing/geo-weekly.ts
//
// 거래처 GEO 주간 리포트 — 성과·AI인용·업무를 집계해 성과/리스크/다음액션을 도출.
// ERP엔 월간 리포트(report-assembly)·직원 주간(WeeklyReport)만 있고 "거래처 GEO 주간"이 없어 추가(통합 v2 M3).
// 원칙(정직성): 통계를 지어내지 않는다 — 실측 GeoAnswerRecord·ChannelMetric·WorkItem 값만. 스키마 변경/저장 없음(파생).
// 순수 집계 로직(buildGeoWeekly)은 db와 분리해 테스트 가능하게 둔다(report-assembly 패턴).

import { db } from "@/server/db";
import { WorkStatus } from "@/domain/types";
import { geoMonthlySummary } from "@/server/repositories/geo";

export type GeoWeeklyMetric = { name: string; latest: number; prev: number | null; betterWhenLower?: boolean };

export type GeoWeeklyInput = {
  clientName: string;
  region?: string | null;
  weekLabel: string; // 예: "2026-W29"
  exposure: { monitored: number; appeared: number; cited: number } | null;
  sovPct?: number | null; // M1 computeGeoSov 결과(선택 주입)
  metrics?: GeoWeeklyMetric[]; // 성과 델타(선택)
  work: { total: number; done: number; approvalPending: number; failed: number };
};

export type GeoWeeklyReport = {
  clientName: string;
  weekLabel: string;
  summary: string;
  keyWins: string[];
  risks: string[];
  nextActions: string[];
};

/** 순수 집계 — 실측 입력만으로 성과/리스크/다음액션 도출. db 의존 없음. */
export function buildGeoWeekly(input: GeoWeeklyInput): GeoWeeklyReport {
  const keyWins: string[] = [];
  const risks: string[] = [];
  const nextActions: string[] = [];

  const ex = input.exposure;
  if (ex) {
    if (ex.appeared > 0) keyWins.push(`AI 답변 출현 질문 ${ex.appeared}/${ex.monitored}`);
    else risks.push("이번 주 AI 답변 출현 질문 0 — 콘텐츠·질문 설계 점검");
    if (ex.cited > 0) keyWins.push(`공식 URL 인용 질문 ${ex.cited}`);
  } else {
    nextActions.push("AI 인용 실측 미실행 — 승인 질문 관측 실행");
  }

  if (typeof input.sovPct === "number") {
    if (input.sovPct >= 50) keyWins.push(`경쟁사 대비 SOV ${input.sovPct}% (우위)`);
    else {
      risks.push(`경쟁사 대비 SOV ${input.sovPct}% (열세)`);
      nextActions.push("경쟁사 우위 채널 분석 → 해당 채널 콘텐츠 강화");
    }
  }

  for (const m of input.metrics ?? []) {
    if (m.prev == null) continue;
    const delta = Math.round((m.latest - m.prev) * 100) / 100;
    if (delta === 0) continue;
    const improved = m.betterWhenLower ? delta < 0 : delta > 0;
    const sign = delta > 0 ? "+" : "";
    (improved ? keyWins : risks).push(`${m.name} ${improved ? "개선" : "악화"}: ${m.latest} (직전 대비 ${sign}${delta})`);
  }

  const w = input.work;
  if (w.approvalPending > 0) nextActions.push(`승인 대기 업무 ${w.approvalPending}건 처리`);
  if (w.failed > 0) risks.push(`중단(BLOCKED) 업무 ${w.failed}건 — 재작업/해제`);
  if (w.total > 0) keyWins.push(`업무 완료율 ${Math.round((w.done / w.total) * 100)}% (${w.done}/${w.total})`);
  else nextActions.push("이번 주 배정 업무 없음 — 채널 플레이북에서 생성");

  if (nextActions.length === 0) nextActions.push("현 채널 최적화 지속 · 분기 콘텐츠 갱신");

  const summary = [
    `${input.clientName}${input.region ? " · " + input.region : ""}`,
    ex ? `출현 ${ex.appeared}/${ex.monitored}·인용 ${ex.cited}` : "AI 실측 없음",
    typeof input.sovPct === "number" ? `SOV ${input.sovPct}%` : null,
    w.total > 0 ? `업무 완료율 ${Math.round((w.done / w.total) * 100)}%` : null
  ]
    .filter(Boolean)
    .join(" · ");

  return { clientName: input.clientName, weekLabel: input.weekLabel, summary, keyWins, risks, nextActions };
}

/**
 * 거래처 주간 GEO 리포트 조립 — geoMonthlySummary(주간 창 재사용) + WorkItem 집계로 입력을 모아 buildGeoWeekly 호출.
 * SOV는 선택 주입(M1 computeGeoSov 결과). 저장하지 않고 반환(파생·스키마 0).
 */
export async function assembleGeoWeekly(
  clientId: string,
  weekStart: Date,
  weekEnd: Date,
  opts?: { clientName?: string; region?: string | null; weekLabel?: string; sovPct?: number | null; metrics?: GeoWeeklyMetric[] }
): Promise<GeoWeeklyReport> {
  const [ex, client, total, done, approvalPending, failed] = await Promise.all([
    geoMonthlySummary(clientId, weekStart, weekEnd),
    db.client.findUnique({ where: { id: clientId }, select: { name: true, region: true } }),
    db.workItem.count({ where: { clientId, dueDate: { gte: weekStart, lt: weekEnd } } }),
    db.workItem.count({ where: { clientId, dueDate: { gte: weekStart, lt: weekEnd }, status: WorkStatus.COMPLETED } }),
    db.workItem.count({ where: { clientId, status: WorkStatus.CLIENT_APPROVAL } }),
    db.workItem.count({ where: { clientId, status: WorkStatus.BLOCKED } })
  ]);

  return buildGeoWeekly({
    clientName: opts?.clientName ?? client?.name ?? "거래처",
    region: opts?.region ?? client?.region ?? null,
    weekLabel: opts?.weekLabel ?? weekStart.toISOString().slice(0, 10),
    exposure: { monitored: ex.monitoredQuestions, appeared: ex.appearedQuestions, cited: ex.citedQuestions },
    sovPct: opts?.sovPct ?? null,
    metrics: opts?.metrics ?? [],
    work: { total, done, approvalPending, failed }
  });
}
