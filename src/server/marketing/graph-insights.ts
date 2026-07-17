// src/server/marketing/graph-insights.ts
//
// Graph RAG Lite — Prisma 멀티홉 관계 쿼리로 업종 내 크로스 거래처 키워드 인사이트 제공.
//
// 홉 구조:
//   Client (현재 거래처)
//     → IndustryCategory (공유 업종 카테고리)
//       → Client[] (동일 업종 타 거래처, active)
//         → KeywordResearch[] (최근 키워드 리서치 결과)
//
// 설계 원칙:
//   - Neo4j 없이 Prisma include로 3-홉 그래프 순회 구현 (Graph RAG Lite).
//   - 거래처 간 데이터 프라이버시: clientName은 포함하되 원시 개인정보(연락처 등)는 제외.
//   - 결과는 서버 액션(getClientIndustryInsights)을 통해서만 노출.

import { db } from "@/server/db";

export type ClientKeywordInsight = {
  clientId: string;
  clientName: string;
  seedKeyword: string;
  results: unknown; // KeywordResearch.results Json 원본
  collectedAt: Date;
};

export type CrossClientInsightsResult = {
  industryCategoryId: string | null;
  industryCategoryName: string | null;
  similarClientCount: number;
  insights: ClientKeywordInsight[];
};

/**
 * 현재 거래처와 동일 업종의 타 거래처 키워드 리서치 결과를 집계한다.
 *
 * @param clientId 기준 거래처 ID
 * @param maxPerClient 거래처당 최대 키워드 리서치 건수 (기본 5)
 * @returns 동일 업종 거래처들의 최근 키워드 인사이트 집계
 */
export async function findCrossClientKeywordInsights(
  clientId: string,
  { maxPerClient = 5 }: { maxPerClient?: number } = {},
): Promise<CrossClientInsightsResult> {
  // Hop 1: 현재 거래처의 업종 카테고리 확인
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      industryCategoryId: true,
      industryCategory: { select: { name: true } },
    },
  });

  if (!client?.industryCategoryId) {
    // 업종 미지정 거래처: 빈 결과 반환
    return {
      industryCategoryId: null,
      industryCategoryName: null,
      similarClientCount: 0,
      insights: [],
    };
  }

  // Hop 2 → Hop 3: 동일 업종 활성 거래처 + 최근 키워드 리서치
  const similarClients = await db.client.findMany({
    where: {
      industryCategoryId: client.industryCategoryId,
      id: { not: clientId }, // 자기 자신 제외
      active: true,
    },
    select: {
      id: true,
      name: true,
      keywordResearch: {
        orderBy: { collectedAt: "desc" },
        take: maxPerClient,
        select: {
          seedKeyword: true,
          results: true,
          collectedAt: true,
        },
      },
    },
  });

  // 플래튼: 거래처 × 키워드 리서치 목록 → 단일 인사이트 배열
  const insights: ClientKeywordInsight[] = similarClients.flatMap((c) =>
    c.keywordResearch.map((kr) => ({
      clientId: c.id,
      clientName: c.name,
      seedKeyword: kr.seedKeyword,
      results: kr.results,
      collectedAt: kr.collectedAt,
    })),
  );

  // 최근 수집 순 정렬
  insights.sort((a, b) => b.collectedAt.getTime() - a.collectedAt.getTime());

  return {
    industryCategoryId: client.industryCategoryId,
    industryCategoryName: client.industryCategory?.name ?? null,
    similarClientCount: similarClients.length,
    insights,
  };
}
