// 목표 경로: src/server/geo-engine/detect.ts
//
// GEO 자동 관측 — 답변 텍스트·인용 URL에서 병원 언급(출현)·공식 URL 인용·경쟁사 언급을 판정.
// 순수 함수(DB·네트워크 없음) — 단위 테스트 대상.

export type DetectTarget = {
  hospitalName: string; // 병원명(공백 변형 허용 매칭)
  siteDomain?: string | null; // 공식 도메인 (예: myclinic.co.kr)
  competitors?: string[]; // 경쟁 병원명 목록
};

export type DetectResult = {
  appeared: boolean;
  cited: boolean;
  competitorsMentioned: string[];
  position: number | null; // 답변 내 우리 등장 순위(1=경쟁사보다 먼저 언급). 이름 미등장 시 null.
};

/** 한국어 병원명 매칭용 정규화 — 공백 제거·소문자화. */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

/** "sc-domain:foo.co.kr" · "https://foo.co.kr/" · "foo.co.kr" → "foo.co.kr" */
export function extractDomain(input?: string | null): string | null {
  if (!input) return null;
  let v = input.trim().toLowerCase();
  if (v.startsWith("sc-domain:")) v = v.slice("sc-domain:".length);
  v = v.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const domain = v.split(/[/?#]/)[0].trim();
  return domain || null;
}

export function detectAnswer(text: string, citations: string[], target: DetectTarget): DetectResult {
  const normText = norm(text);
  const name = norm(target.hospitalName);
  // "[데모]" 등 괄호 접두는 매칭에서 제외
  const cleanName = name.replace(/^\[[^\]]*\]/, "");

  const appearedInText = cleanName.length >= 2 && normText.includes(cleanName);

  const domain = extractDomain(target.siteDomain);
  const citedByUrl = Boolean(
    domain && citations.some((u) => extractDomain(u) === domain || norm(u).includes(domain))
  );
  const citedInText = Boolean(domain && normText.includes(domain));
  const cited = citedByUrl || citedInText;

  const competitorsMentioned = (target.competitors ?? [])
    .map((c) => c.trim())
    .filter((c) => c.length >= 2 && normText.includes(norm(c)));

  // 등장 순위(citation_position) — 우리 이름의 첫 등장 위치를 경쟁사 대비로 순위화(자동 캡처).
  // 근거: What Gets Cited — 위치가 인용 확률의 top driver. 이름 미등장 시 null(순서 불명).
  let position: number | null = null;
  const ourIdx = appearedInText ? normText.indexOf(cleanName) : -1;
  if (ourIdx >= 0) {
    const earlier = (target.competitors ?? [])
      .map((c) => normText.indexOf(norm(c.trim())))
      .filter((i) => i >= 0 && i < ourIdx).length;
    position = 1 + earlier;
  }

  // 공식 URL이 인용됐다면 병원이 노출된 것으로 간주(이름 미표기 케이스 보정)
  return { appeared: appearedInText || cited, cited, competitorsMentioned, position };
}
