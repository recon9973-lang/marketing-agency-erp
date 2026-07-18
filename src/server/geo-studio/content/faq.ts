// GEO Studio · M3 콘텐츠 빌더 — FAQ 생성 + FAQPage JSON-LD (원본 faq.py 이식).
// 라이브 Claude 생성은 P0에서 주입. 키 없을 때 본문 기반 결정적 Q&A + 항상 유효한 JSON-LD.
import { normalize, sentences, stripMarkdown, topKeywords } from "./textutil";
import type { FaqItem, FaqSchema } from "./models";

const QUESTION_TEMPLATES = [
  "{kw}란 무엇인가요?",
  "{kw}는 어떻게 선택하나요?",
  "{kw}의 장점은 무엇인가요?",
  "{kw} 이용 시 주의할 점은?",
  "{kw} 비용은 어떻게 되나요?"
];

/** 본문 핵심 문장을 답으로, 키워드 조합을 질문으로 결정적 생성. */
export function ruleFaq(content: string, keyword: string, count: number): FaqItem[] {
  const sents = sentences(stripMarkdown(content));
  let kws = [...(keyword ? [keyword] : []), ...topKeywords(content, 5)];
  kws = [...new Set(kws.filter(Boolean))].slice(0, count);
  if (kws.length === 0) kws = [keyword || "이 주제"];

  const items: FaqItem[] = [];
  kws.forEach((kw, i) => {
    const q = QUESTION_TEMPLATES[i % QUESTION_TEMPLATES.length].replace("{kw}", kw);
    const nkw = normalize(kw);
    const found = sents.find((s) => normalize(s).includes(nkw));
    const answer = found ?? (i < sents.length ? sents[i] : `${kw}에 대한 핵심 정보를 정리했습니다.`);
    items.push({ question: q, answer });
  });
  return items;
}

/** FAQPage JSON-LD 직렬화(schema.org 표준). 파이썬 json.dumps(indent=2, ensure_ascii=False) 동등. */
export function buildJsonLd(items: FaqItem[]): string {
  const payload = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: { "@type": "Answer", text: it.answer }
    }))
  };
  return JSON.stringify(payload, null, 2);
}

/** 생성된 JSON-LD 유효성 검사. */
export function validateJsonLd(code: string): { valid: boolean; errors: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(code);
  } catch (e) {
    return { valid: false, errors: [`JSON 파싱 오류: ${(e as Error).message}`] };
  }
  const errors: string[] = [];
  const d = data as { "@type"?: string; mainEntity?: Array<{ name?: string; acceptedAnswer?: { text?: string } }> };
  if (d["@type"] !== "FAQPage") errors.push("@type 이 FAQPage 가 아님");
  const entities = d.mainEntity ?? [];
  if (entities.length === 0) errors.push("mainEntity 가 비어 있음");
  entities.forEach((q, i) => {
    if (!q.name) errors.push(`질문 ${i + 1} name 누락`);
    if (!q.acceptedAnswer?.text) errors.push(`질문 ${i + 1} 답변 text 누락`);
  });
  return { valid: errors.length === 0, errors };
}

/** 콘텐츠 → FAQ + JSON-LD (규칙 경로). */
export function generateFaq(content: string, keyword = "", count = 5): FaqSchema {
  const items = ruleFaq(content, keyword, count);
  return { items, jsonLd: buildJsonLd(items), isDeployed: false };
}
