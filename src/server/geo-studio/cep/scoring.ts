// GEO Studio · M2 CEP 파인더 — 점수화 (원본 scoring.py 이식).
// Priority Score = AI 언급 × 경쟁 공백 × 시장 크기 가중합(0~100). 경쟁 적을수록↑.
import { pyRound } from "../py-compat";

export const W_MENTION = 0.45;
export const W_OPPORTUNITY = 0.35; // 경쟁 공백 기회(1 - 경쟁강도)
export const W_MARKET = 0.2;

function norm(value: number, ceiling: number): number {
  if (ceiling <= 0) return 0.0;
  return Math.min(1.0, value / ceiling);
}

export function priorityScore(
  aiMentionCount: number,
  competitorCount: number,
  keywordDiversity: number,
  ceilings: { mentionCeiling: number; competitorCeiling: number; keywordCeiling: number }
): number {
  const mention = norm(aiMentionCount, ceilings.mentionCeiling);
  const opportunity = 1.0 - norm(competitorCount, ceilings.competitorCeiling);
  const market = norm(keywordDiversity, ceilings.keywordCeiling);
  const score = W_MENTION * mention + W_OPPORTUNITY * opportunity + W_MARKET * market;
  return pyRound(score * 100, 1);
}

/** 화이트스페이스: 자사·경쟁사 아무도 선점 못 한 공백. */
export function isWhitespace(brandMentionCount: number, competitorCount: number): boolean {
  return competitorCount === 0 && brandMentionCount === 0;
}
