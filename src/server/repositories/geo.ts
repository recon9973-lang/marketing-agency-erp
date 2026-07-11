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
  priority: number;
  status: string;
  targetPageUrl: string | null;
  approvedAt: string | null;
  cells: Partial<Record<GeoEngine, GeoCell>>;
};

export async function listGeoMatrix(clientId: string): Promise<GeoQuestionRow[]> {
  const questions = await db.geoQuestion.findMany({
    where: { clientId, status: { not: "RETIRED" } },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    include: {
      answerRecords: {
        orderBy: { checkedOn: "desc" },
        take: GEO_ENGINES.length * 12 // 엔진당 최근 관측 여유분
      }
    }
  });

  return questions.map((q) => {
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
      priority: q.priority,
      status: q.status,
      targetPageUrl: q.targetPageUrl,
      approvedAt: q.approvedAt?.toISOString() ?? null,
      cells
    };
  });
}

export type GeoSummary = {
  totalQuestions: number;
  candidateCount: number;
  monitoredCount: number;
  appearedCount: number; // 최신 관측 기준 1개 이상 엔진에서 출현한 질문 수
  citedCount: number;
};

export function summarizeGeoMatrix(rows: GeoQuestionRow[]): GeoSummary {
  const monitored = rows.filter((r) => Object.keys(r.cells).length > 0);
  return {
    totalQuestions: rows.length,
    candidateCount: rows.filter((r) => r.status === "CANDIDATE").length,
    monitoredCount: monitored.length,
    appearedCount: monitored.filter((r) => Object.values(r.cells).some((c) => c?.appeared)).length,
    citedCount: monitored.filter((r) => Object.values(r.cells).some((c) => c?.cited)).length
  };
}