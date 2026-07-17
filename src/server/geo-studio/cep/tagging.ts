// GEO Studio · M2 CEP 파인더 — 5차원 CEP 태깅 (원본 tagging.py 이식).
// 클러스터 대표 문장에서 상황/감성/시간/장소/동반자 5축을 규칙 기반 결정적 매칭.
import { TAG_AXES, type TagAxis } from "./models";

type LexEntry = [surfaces: string[], tag: string];

const LEXICON: Record<TagAxis, LexEntry[]> = {
  situation: [
    [["급", "바로", "당장"], "긴급"],
    [["처음", "입문", "초보"], "입문"],
    [["기념", "생일", "특별", "이벤트"], "특별한 날"],
    [["가성비", "저렴", "합리"], "가성비"],
    [["실패", "후회", "믿", "신뢰"], "신뢰 확인"]
  ],
  emotion: [
    [["힐링", "조용", "여유", "쉬"], "힐링"],
    [["설레", "특별", "기대"], "기대감"],
    [["만족", "후기", "평판", "인기"], "안심"],
    [["가성비", "합리", "실속"], "실속"]
  ],
  time: [
    [["주말", "토요일", "일요일"], "주말"],
    [["평일"], "평일"],
    [["저녁", "밤", "야간"], "저녁"],
    [["아침", "오전", "브런치"], "아침"],
    [["요즘", "최신", "트렌드"], "최신 트렌드"]
  ],
  place: [
    [["서울", "수도권"], "서울"],
    [["근처", "동네", "가까"], "근거리"],
    [["지방", "지역", "로컬"], "지방"],
    [["접근", "역세권", "교통"], "접근성"]
  ],
  companion: [
    [["아이", "자녀", "키즈"], "아이 동반"],
    [["가족", "부모", "온가족"], "가족"],
    [["혼자", "솔로", "1인"], "혼자"],
    [["친구", "지인", "모임"], "친구"],
    [["반려", "펫", "강아지", "고양이"], "반려동물"]
  ]
};

/** 파이썬 str.count — 비겹침 부분문자열 개수. */
function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0;
  return hay.split(needle).length - 1;
}

/** 축 하나에서 멤버 문장 전체 기준 최빈 태그(동점→사전 등장 순서). */
function tagAxis(texts: string[], axis: TagAxis): string {
  const joined = texts.join(" ");
  let bestTag = "";
  let bestCount = 0;
  for (const [surfaces, tag] of LEXICON[axis]) {
    const hits = surfaces.reduce((s, sf) => s + countOccurrences(joined, sf), 0);
    // votes[tag] += hits (각 tag 축당 1회) → 최대값 첫 등장 우선
    if (hits > 0 && hits > bestCount) {
      bestCount = hits;
      bestTag = tag;
    }
  }
  return bestTag;
}

export function tagCluster(memberTexts: string[]): Record<TagAxis, string> {
  const out = {} as Record<TagAxis, string>;
  for (const axis of TAG_AXES) out[axis] = tagAxis(memberTexts, axis);
  return out;
}

const ALL_SURFACES: string[] = TAG_AXES.flatMap((axis) => LEXICON[axis].flatMap(([surfaces]) => surfaces));

function signalOf(t: string): number {
  return ALL_SURFACES.reduce((s, sf) => s + countOccurrences(t, sf), 0);
}

/** 클러스터 대표 CEP 문장 — 신호 밀도 높고 간결한 문장(동점→첫 문장). 파이썬 max(key=(signal,-len)) 재현. */
export function representativeText(memberTexts: string[]): string {
  if (memberTexts.length === 0) return "";
  let best = memberTexts[0];
  let bestSignal = signalOf(best);
  let bestNegLen = -best.length;
  for (let i = 1; i < memberTexts.length; i++) {
    const t = memberTexts[i];
    const sig = signalOf(t);
    const negLen = -t.length;
    if (sig > bestSignal || (sig === bestSignal && negLen > bestNegLen)) {
      best = t;
      bestSignal = sig;
      bestNegLen = negLen;
    }
  }
  return best;
}
