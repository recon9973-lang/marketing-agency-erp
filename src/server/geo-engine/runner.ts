// 목표 경로: src/server/geo-engine/runner.ts
//
// GEO 자동 관측 실행기 — 승인/모니터링 질문을 설정된 엔진들에 자동으로 물어보고
// 출현·인용·경쟁사 언급을 판정해 GeoAnswerRecord에 기록한다(질문×엔진×일자 멱등 upsert).
// 수동 기록과 구분: memo = "자동 관측", 답변 원문은 snippet에 보존(증빙).
// 엔진·질문 단위 오류는 격리(하나 실패해도 나머지 계속).

import { db } from "@/server/db";
import { configuredEngines } from "@/server/geo-engine/engines";
import { detectAnswer, extractDomain } from "@/server/geo-engine/detect";
import { recomputeCitationScores } from "@/server/repositories/citation-score";

const AUTO_MEMO = "자동 관측";
const SNIPPET_MAX = 1500;
const QUESTIONS_PER_CLIENT = 20; // 기획서 §5-7 표준 세트 크기 = 비용 상한

export type GeoWatchResult = {
  clients: number;
  engines: string[];
  asked: number;
  appeared: number;
  cited: number;
  failed: number;
};

/**
 * clientId를 주면 해당 거래처만, 없으면 질문 보유 거래처 전체를 관측.
 * 오늘 이미 자동 기록된 (질문×엔진)은 건너뜀(중복 호출 비용 방지).
 */
export async function runGeoWatch(clientId?: string, now = new Date()): Promise<GeoWatchResult> {
  const engines = configuredEngines();
  const result: GeoWatchResult = { clients: 0, engines: engines.map((e) => e.engine), asked: 0, appeared: 0, cited: 0, failed: 0 };
  if (engines.length === 0) return result;

  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const clients = await db.client.findMany({
    where: {
      active: true,
      ...(clientId ? { id: clientId } : {}),
      geoQuestions: { some: { status: { in: ["APPROVED", "MONITORING"] } } }
    },
    select: {
      id: true,
      name: true,
      hospitalProfile: { select: { competitorHospitals: true } },
      channelConnections: { where: { provider: "GOOGLE" }, select: { gscSiteUrl: true }, take: 1 },
      geoQuestions: {
        where: { status: { in: ["APPROVED", "MONITORING"] } },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        take: QUESTIONS_PER_CLIENT,
        select: { id: true, question: true, status: true }
      }
    }
  });
  result.clients = clients.length;

  for (const client of clients) {
    const siteDomain = extractDomain(client.channelConnections[0]?.gscSiteUrl);
    const competitors =
      client.hospitalProfile?.competitorHospitals
        ?.split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean) ?? [];

    for (const q of client.geoQuestions) {
      for (const adapter of engines) {
        try {
          // 오늘 자동 기록이 이미 있으면 스킵(비용·중복 방지). 수동 기록은 덮어쓰지 않음.
          const existing = await db.geoAnswerRecord.findUnique({
            where: { questionId_engine_checkedOn: { questionId: q.id, engine: adapter.engine, checkedOn: day } },
            select: { id: true, memo: true }
          });
          if (existing) continue;

          const answer = await adapter.ask(q.question);
          const verdict = detectAnswer(answer.text, answer.citations, {
            hospitalName: client.name,
            siteDomain,
            competitors
          });

          await db.geoAnswerRecord.create({
            data: {
              questionId: q.id,
              engine: adapter.engine,
              checkedOn: day,
              appeared: verdict.appeared,
              cited: verdict.cited,
              competitorsMentioned: verdict.competitorsMentioned,
              rank: verdict.position, // 자동: 답변 내 등장 순위
              citationPosition: verdict.cited ? verdict.position : null, // 인용 시 위치
              snippet: answer.text.slice(0, SNIPPET_MAX) || null,
              // 충실성(claimSupported)·답변비중(answerShare)은 자동 판정 불가 → 수동 검수 대상(null 유지)
              memo: AUTO_MEMO
            }
          });
          result.asked++;
          if (verdict.appeared) result.appeared++;
          if (verdict.cited) result.cited++;
        } catch (e) {
          result.failed++;
          console.warn(`[geo-watch] ${adapter.engine} 실패(질문 ${q.id}): ${String(e).slice(0, 120)}`);
        }
      }
      // 첫 자동 기록이 생긴 승인 질문은 모니터링 상태로 전이
      if (q.status === "APPROVED") {
        await db.geoQuestion
          .update({ where: { id: q.id }, data: { status: "MONITORING" } })
          .catch(() => undefined);
      }
    }

    // 이 거래처의 일별 인용점수 스냅샷 재계산 — 대시보드·리포트 그래프 데이터를
    // 자동 관측 직후 갱신(멱등). 이게 없으면 자동 관측이 돌아도 그래프가 안 쌓인다.
    await recomputeCitationScores(client.id).catch((e) => {
      console.warn(`[geo-watch] 인용점수 재계산 실패(거래처 ${client.id}): ${String(e).slice(0, 120)}`);
    });
  }

  return result;
}
