// GEO Studio · M3 콘텐츠 빌더 — 텍스트 파싱 유틸 (원본 textutil.py 이식).
// 규칙 기반 GEO 점수 계산의 기반(문장 분리·정규화·키워드 추출).

const SENTENCE_END = /(?<=[.!?。！？])\s+|\n+/;
const MD = /[#>*_`\-]+/g;
const JOSA = ["은", "는", "이", "가", "을", "를", "의", "에", "에서", "으로", "로", "와", "과", "도", "만"];

export function normalize(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function stripMarkdown(text: string): string {
  return text.replace(MD, " ").replace(/\s+/g, " ").trim();
}

export function sentences(text: string): string[] {
  return text.split(SENTENCE_END).map((s) => s.trim()).filter(Boolean);
}

export function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

/** 조사를 떼고 명사류 후보 토큰을 추출(경량 한국어). */
export function keywords(text: string, minLen = 2): string[] {
  const out: string[] = [];
  const toks = normalize(text).match(/[가-힣A-Za-z0-9]+/g) ?? [];
  for (let tok of toks) {
    for (const j of JOSA) {
      if (tok.endsWith(j) && tok.length > j.length + 1) {
        tok = tok.slice(0, -j.length);
        break;
      }
    }
    if (tok.length >= minLen) out.push(tok);
  }
  return out;
}

/** 빈도 상위 키워드(불용어 제외). 동점은 첫 등장 순서(파이썬 Counter.most_common). */
export function topKeywords(text: string, n = 10): string[] {
  const stop = new Set(["그리고", "하지만", "그래서", "또한", "합니다", "입니다", "있습니다", "때문", "위해"]);
  const counts = new Map<string, number>();
  for (const k of keywords(text)) {
    if (stop.has(k)) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([w, c], i) => ({ w, c, i }))
    .sort((a, b) => b.c - a.c || a.i - b.i)
    .slice(0, n)
    .map((x) => x.w);
}
