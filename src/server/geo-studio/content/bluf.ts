// GEO Studio · M3 콘텐츠 빌더 — BLUF 분석·재작성 (원본 bluf.py 이식, 규칙 기반).
// 라이브 GPT 재작성은 P0 LLM 레이어에서 주입. 키 없을 때 규칙 재배치로 동일 동작.
import { keywords, normalize, sentences, stripMarkdown } from "./textutil";

const FILLER_OPENERS = ["안녕하세요", "오늘은", "이번에는", "이번 글에서는", "알아보겠습니다", "살펴보겠습니다", "소개하겠습니다", "다뤄보겠습니다", "함께", "지금부터"];
const DEFINITION_SIGNALS = ["란", "는 ", "은 ", "이란", "정의", "의미", "말합니다", "입니다", "됩니다"];

/** 첫 100자 내 핵심 명사 밀도 기반 BLUF 점수 0~100. */
export function blufScore(content: string, keyword = ""): number {
  const text = stripMarkdown(content);
  if (!text) return 0.0;
  const head = text.slice(0, 100);
  const headKws = new Set(keywords(head));
  if (headKws.size === 0) return 0.0;

  let score = Math.min(headKws.size * 12, 60);
  if (keyword && normalize(head).includes(normalize(keyword))) score += 25;
  if (FILLER_OPENERS.some((op) => head.includes(op))) score -= 30;
  const sents = sentences(text);
  const first = sents.length ? sents[0] : "";
  if (DEFINITION_SIGNALS.some((sig) => first.includes(sig))) score += 15;
  return Math.max(0, Math.min(100, score));
}

/** 규칙 기반 BLUF 재작성: 낭비 도입부 제거 + 핵심 문장 전진 배치. */
export function ruleRewrite(content: string, keyword = ""): string {
  const sents = sentences(stripMarkdown(content));
  if (sents.length === 0) return content;
  let kept = sents.filter((s) => !FILLER_OPENERS.some((op) => s.includes(op)));
  if (kept.length === 0) kept = sents;

  const rank = (s: string): [number, number] => {
    const hasKw = keyword && normalize(s).includes(normalize(keyword)) ? 1 : 0;
    const hasDef = DEFINITION_SIGNALS.some((sig) => s.includes(sig)) ? 1 : 0;
    return [hasKw + hasDef, -s.length];
  };
  // 파이썬 max(key=rank) — 첫 최댓값 유지
  let lead = kept[0];
  let bestA = rank(lead)[0];
  let bestB = rank(lead)[1];
  for (let i = 1; i < kept.length; i++) {
    const [a, b] = rank(kept[i]);
    if (a > bestA || (a === bestA && b > bestB)) {
      lead = kept[i];
      bestA = a;
      bestB = b;
    }
  }
  const body = kept.filter((s) => s !== lead);
  return lead + (body.length ? " " + body.join(" ") : "");
}
