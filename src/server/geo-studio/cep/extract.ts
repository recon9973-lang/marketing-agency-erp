// GEO Studio · M2 CEP 파인더 — 맥락 추출 (원본 extract.py 이식).
// AI 응답 문장에서 CEP 후보(맥락 수식이 붙은 명사구) 문장을 골라낸다.
import type { CepCandidate } from "./models";

const SENTENCE_END = /(?<=[.!?。！？])\s+|\n+/;
const LIST_PREFIX = /^\s*(?:\d+[.)]|[-*•])\s*/;
const EXPLAIN_SPLIT = /\s*[—–\-:]\s+/; // 설명절 구분자(em/en dash, 하이픈, 콜론)

// 맥락 신호어 — 있으면 CEP 후보 확률↑
const CONTEXT_SIGNALS = [
  "때", "위해", "함께", "혼자", "가족", "친구", "아이", "반려", "주말", "평일",
  "저녁", "아침", "근처", "동네", "여행", "기념일", "생일", "가성비", "감성",
  "조용", "힐링", "특별", "급할", "처음", "요즘", "추천"
];

// 도입·마무리 상투구(CEP 아님)
const BOILERPLATE = [
  "추천드립니다", "추천합니다", "추천해 드립니다", "안내드립니다", "알려드립니다",
  "확인하세요", "확인하시기", "확인해", "참고하세요", "참고하시기",
  "다음과 같", "아래와 같", "도움이 되", "좋은 선택"
];

export function normalize(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/** 문장에서 CEP 핵심 명사구만 남긴다('~ 숙소 — 평판이 좋습니다' → '~ 숙소'). */
export function cepPhrase(sentence: string): string {
  const n = normalize(sentence);
  const head = n.split(EXPLAIN_SPLIT)[0].trim();
  return head.length >= 5 ? head : n;
}

function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(SENTENCE_END)) {
    const s = raw.replace(LIST_PREFIX, "").trim();
    if (s) out.push(s);
  }
  return out;
}

function mentions(sentence: string, name: string): boolean {
  if (!name.trim()) return false;
  return normalize(sentence).toLowerCase().includes(normalize(name).toLowerCase());
}

function isCepCandidate(sentence: string): boolean {
  const n = normalize(sentence);
  if (n.length < 6) return false;
  if (BOILERPLATE.some((bp) => n.includes(bp))) return false;
  return CONTEXT_SIGNALS.some((sig) => n.includes(sig));
}

export type AiResponseLike = { platform: string; text: string; error?: string | null };

/** AI 응답 1건에서 CEP 후보 문장들을 뽑는다. */
export function extractCandidates(
  response: AiResponseLike,
  keyword: string,
  probe: string,
  brand: string,
  competitors: string[]
): CepCandidate[] {
  if (response.error || !response.text.trim()) return [];
  const out: CepCandidate[] = [];
  for (const sentence of splitSentences(response.text)) {
    if (!isCepCandidate(sentence)) continue;
    const compHits = competitors.filter((c) => mentions(sentence, c));
    out.push({
      text: cepPhrase(sentence),
      sourceAi: response.platform,
      keyword,
      probe,
      brandMentioned: mentions(sentence, brand),
      competitorsMentioned: compHits
    });
  }
  return out;
}
