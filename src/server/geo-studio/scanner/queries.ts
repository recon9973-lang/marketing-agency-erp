// GEO Studio · M1 GEO 스캐너 — 쿼리 변형 생성 (원본 queries.py 이식).
// 키워드 1개 → 3변형(정보/비교/질문) × 4 AI 템플릿.

const VARIATION_TEMPLATES: [name: string, tpl: string][] = [
  ["정보형", "{keyword} 추천해줘"],
  ["비교형", "{keyword} 중 어디가 가장 좋아?"],
  ["질문형", "{keyword} 어디가 좋은지 이유와 함께 알려줘"]
];

const AI_TEMPLATES: Record<string, string> = {
  chatgpt: "{query} 추천할 만한 서비스/브랜드를 알려줘.",
  gemini: "{query} 검색 결과를 기반으로 브랜드를 추천해줘.",
  claude: "{query} 신뢰할 수 있는 한국 브랜드/서비스를 알려줘.",
  perplexity: "{query} 최신 정보 기반으로 알려줘."
};

export type Query = { keyword: string; variation: string; text: string };

export function promptFor(query: Query, platform: string): string {
  return (AI_TEMPLATES[platform] ?? "{query}").replace("{query}", query.text);
}

export function generateVariations(keyword: string, count = 3): Query[] {
  if (count < 1) throw new Error("count 는 1 이상이어야 합니다");
  return VARIATION_TEMPLATES.slice(0, count).map(([name, tpl]) => ({ keyword, variation: name, text: tpl.replace("{keyword}", keyword) }));
}

export function buildQueries(keywords: string[], count = 3): Query[] {
  return keywords.flatMap((kw) => generateVariations(kw, count));
}
