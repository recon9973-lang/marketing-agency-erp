// GEO Studio · M5 — 채널 전략 믹스 플래너 (원본 mix.py 이식).
// 업종·예산·우선순위 CEP 수 → 채널별 예산 배분·콘텐츠 수·예상 인용 상승폭.
import { pyRound } from "./py-compat";
import { CATALOG, citationWeight } from "./channels";
import type { ChannelAllocation, ChannelMix } from "./models";

// 채널별 콘텐츠 1건당 기대 인용 상승폭(%p) 근사 — 별점 기반
const BOOST_PER_CONTENT: Record<number, number> = { 5: 1.5, 4: 1.0, 3: 0.6, 2: 0.3, 1: 0.15 };

/** 업종별 권장 채널 셋. 의료·전문 서비스는 권위 채널 비중↑. */
function defaultChannels(industry: string): string[] {
  const has = (arr: string[]) => arr.some((k) => industry.includes(k));
  if (has(["의료", "병원", "한의원", "치과", "법률", "금융"])) return ["blog", "wiki", "press", "naver"];
  if (has(["카페", "음식", "여행", "숙박", "뷰티"])) return ["blog", "naver", "youtube", "reddit"];
  return ["blog", "naver", "press", "reddit"];
}

export function recommendMix(
  industry: string,
  budget: number,
  priorityCepCount = 5,
  channels?: string[]
): ChannelMix {
  let chans = (channels ?? defaultChannels(industry)).filter((c) => c in CATALOG);
  if (chans.length === 0) throw new Error("유효한 채널이 없습니다");

  const weights: Record<string, number> = {};
  for (const c of chans) weights[c] = citationWeight(c);
  const wsum = Object.values(weights).reduce((a, b) => a + b, 0) || 1.0;

  // 별점 비례, 상위 채널 우선(안정 정렬 → 동점은 원래 순서)
  const ordered = chans.slice().sort((a, b) => weights[b] - weights[a]);

  const allocations: ChannelAllocation[] = [];
  let totalBoost = 0.0;
  const cap = Math.max(2, priorityCepCount * 2);

  for (const c of ordered) {
    const pct = pyRound((weights[c] / wsum) * 100, 0);
    const chBudget = Math.trunc((budget * pct) / 100);
    const ch = CATALOG[c];
    let contentCount = ch.unitCost ? Math.max(1, Math.floor(chBudget / ch.unitCost)) : 1;
    contentCount = Math.min(contentCount, cap); // 과도 배정 방지
    const boost = pyRound(contentCount * BOOST_PER_CONTENT[ch.citationStars], 1);
    totalBoost += boost;
    allocations.push({
      channel: c,
      budgetPct: pct,
      budgetAllocation: chBudget,
      contentCount,
      contentTypes: [...ch.contentTypes],
      expectedCitationBoost: boost
    });
  }

  // 예산 잔차 보정: pct 합계를 100에 맞춤
  const drift = 100 - allocations.reduce((s, a) => s + a.budgetPct, 0);
  if (allocations.length && drift) allocations[0].budgetPct += drift;

  const total = pyRound(Math.min(totalBoost, 60.0), 1); // 현실적 상한 캡
  const estRoi = pyRound(total * 12, 0);
  return { allocations, totalExpectedCitationBoost: total, estimatedRoi: estRoi };
}
