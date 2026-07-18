// GEO Studio · M1 GEO 스캐너 — 언급 감지 + 문맥 추출 (원본 detector.py 이식).
// 한국어는 \b가 안 먹혀 정규화 후 부분매칭. 영문 브랜드만 단어경계 강제(AI가 AIR에 오탐 방지).

const SENTENCE_END = /(?<=[.!?。！？])\s+|\n+/;

export function normalize(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 브랜드명 매칭 패턴 본문(공백은 선택적). 영숫자 전용 브랜드는 단어경계 강제. */
function patternBody(brand: string): string {
  const norm = normalize(brand);
  const parts = norm.split(" ").filter(Boolean).map(escapeRegex);
  let body = parts.join("\\s*");
  if (/^[a-z0-9\s]+$/.test(norm)) body = `(?<![a-z0-9])${body}(?![a-z0-9])`;
  return body;
}

export function splitSentences(text: string): string[] {
  return text.split(SENTENCE_END).map((s) => s.trim()).filter(Boolean);
}

export type Detection = { mentioned: boolean; count: number; contexts: string[] };

/** 응답에서 브랜드 언급 여부·횟수·문맥(±window 문장)을 추출. */
export function detect(responseText: string, brand: string, window = 2): Detection {
  if (!responseText || !brand.trim()) return { mentioned: false, count: 0, contexts: [] };

  const body = patternBody(brand);
  const normText = normalize(responseText);
  const count = (normText.match(new RegExp(body, "g")) ?? []).length;
  if (count === 0) return { mentioned: false, count: 0, contexts: [] };

  const sentences = splitSentences(responseText);
  const searchPat = new RegExp(body);
  const hitIndexes: number[] = [];
  sentences.forEach((s, i) => {
    if (searchPat.test(normalize(s))) hitIndexes.push(i);
  });

  const contexts: string[] = [];
  for (const i of hitIndexes) {
    const start = Math.max(0, i - window);
    const end = Math.min(sentences.length, i + window + 1);
    const snippet = sentences.slice(start, end).join(" ");
    if (!contexts.includes(snippet)) contexts.push(snippet);
  }
  return { mentioned: true, count, contexts };
}
