// GEO M4 · 실측 근사 여정 — 네이버 검색광고 연관키워드 인접으로 탐색 트리를 구성.
// 리스닝마인드식 '검색 확장 경로'의 실측 재현. 단, AI 답변 클릭스트림이 아니라
// 연관키워드 확장이므로 호출부는 "실측 근사(연관키워드)"로 정직하게 표기해야 한다.
// 미연결(검색광고 키 없음)이면 null → 목으로 폴백.
import { fetchRelatedKeywords, naverSearchConfigured } from "@/server/integrations/naver-search";
import { makeNode, type JourneyTree } from "./models";

const FOLLOWUP_K = 6; // 1레벨 분기 수
const LEAF_K = 4; // 2레벨(리프) 분기 수

/** 키워드가 브랜드명을 포함하는지 — '이 검색 클러스터에 자사가 존재하나'의 실측 프록시. */
function mentionsBrand(keyword: string, brandNorm: string): boolean {
  if (!brandNorm) return false;
  return keyword.replace(/\s+/g, "").toLowerCase().includes(brandNorm);
}

/**
 * 실측 근사 여정 트리. 검색광고 미연결이면 null.
 * 구조: 시드 → 연관키워드 상위 K(1레벨) → 각 연관키워드의 연관키워드 상위(2레벨 리프).
 */
export async function exploreJourneyLive(seed: string, brand: string): Promise<JourneyTree | null> {
  if (!naverSearchConfigured()) return null;
  const brandNorm = brand.replace(/\s+/g, "").toLowerCase();

  const level1 = await fetchRelatedKeywords(seed, 40);
  const top1 = level1.filter((r) => r.keyword !== seed).slice(0, FOLLOWUP_K);
  if (top1.length === 0) return null;

  const children = await Promise.all(
    top1.map(async (r) => {
      const level2 = await fetchRelatedKeywords(r.keyword, 12);
      const leaves = level2
        .filter((l) => l.keyword !== r.keyword && l.keyword !== seed)
        .slice(0, LEAF_K)
        .map((l) => makeNode({ query: l.keyword, depth: 2, brandMentioned: mentionsBrand(l.keyword, brandNorm) }));
      return makeNode({ query: r.keyword, depth: 1, brandMentioned: mentionsBrand(r.keyword, brandNorm), children: leaves });
    })
  );

  const root = makeNode({ query: seed, depth: 0, brandMentioned: mentionsBrand(seed, brandNorm), children });
  return { brand, seedQuery: seed, root, maxDepth: 2 };
}
