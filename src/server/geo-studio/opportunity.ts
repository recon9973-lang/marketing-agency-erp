// GEO 기회 점수 · 전략 방향성 — 순수 함수(유닛테스트 대상).
// GEO 모듈 설계 §4 B7·B10. 전략은 AI가 아닌 규칙 기반(관측 데이터 → 결정적 제안)으로,
// GEO 실무 매뉴얼(논문 근거)의 우선순위(측정→후보진입→답변콘텐츠→인용증거→외부신뢰)를 따른다.

export type Grade = "매우 높음" | "높음" | "보통" | "낮음";

export function grade(value0to100: number): Grade {
  if (value0to100 >= 60) return "매우 높음";
  if (value0to100 >= 35) return "높음";
  if (value0to100 >= 15) return "보통";
  return "낮음";
}

export type OpportunityInput = {
  mentionRate: number; // 0~100 (AI 언급률)
  citationRate: number; // 0~100 (공식 URL 인용률)
  publishedPages: number; // 게시된 답변/콘텐츠 페이지 수
  hasContent: boolean; // 답변 페이지(초안) 생성 여부
};

export type OpportunityScore = {
  mentionGrade: Grade; // 브랜드 언급률 등급
  absorbGrade: Grade; // 자사 언급 가능성(콘텐츠·인용 준비도)
  totalScore: number; // 0~100 종합 기회점수
};

/**
 * 종합 기회점수 = 언급률(0.5) + 인용률(0.3) + 콘텐츠 준비도(0.2).
 * 콘텐츠 준비도 = 게시 페이지×20 + (답변초안 있으면 20), 100 상한.
 */
export function opportunityScore(input: OpportunityInput): OpportunityScore {
  const readiness = Math.min(100, input.publishedPages * 20 + (input.hasContent ? 20 : 0));
  const total = Math.round(input.mentionRate * 0.5 + input.citationRate * 0.3 + readiness * 0.2);
  return {
    mentionGrade: grade(input.mentionRate),
    absorbGrade: grade(readiness),
    totalScore: total
  };
}

const ENGINE_LABELS: Record<string, string> = {
  CHATGPT: "ChatGPT",
  GEMINI: "Gemini",
  CLAUDE: "Claude",
  PERPLEXITY: "Perplexity",
  AI_OVERVIEW: "Google AI",
  NAVER_AI: "Naver AI"
};

export type StrategyInput = {
  mentionRate: number;
  citationRate: number;
  monitoredCount: number; // 관측 중 질문 수
  hasContent: boolean;
  publishedPages: number;
  weakEngines: string[]; // 현재 언급률이 낮은 엔진
  competitorAhead: string | null; // 우리보다 언급률이 높은 상위 경쟁사(있으면)
};

/**
 * 규칙 기반 전략 방향성(결정적). 매뉴얼 우선순위대로 진단 → 최대 5개 실행 제안.
 * AI 호출 없음(정직): 관측 데이터에서 파생하는 확정적 제안.
 */
export function strategyDirections(input: StrategyInput): string[] {
  const out: string[] = [];

  if (input.monitoredCount === 0) {
    out.push("측정 먼저: 승인 질문을 관측해 기준선(AI 노출 0)을 확정한다.");
    return out;
  }
  // 1) 후보 진입/게시
  if (input.publishedPages === 0) {
    out.push("검색 후보 진입: FAQPage 스키마를 갖춘 답변 콘텐츠를 최소 1건 발행한다.");
  }
  // 2) 답변형 콘텐츠
  if (!input.hasContent) {
    out.push("답변형 콘텐츠: 승인 질문에서 답변 페이지(BLUF·FAQ·근거) 초안을 생성한다.");
  }
  // 3) 인용 증거(언급은 되나 인용 부족)
  if (input.mentionRate >= 20 && input.citationRate < input.mentionRate * 0.5) {
    out.push("인용 증거 강화: 수치·출처·정의 문장(citation unit)과 공식 URL을 본문에 명시한다.");
  }
  // 4) 엔진 갭
  if (input.weakEngines.length > 0) {
    const names = input.weakEngines.map((e) => ENGINE_LABELS[e] ?? e).slice(0, 3).join("·");
    out.push(`엔진 갭: ${names} 언급이 낮다 — 해당 엔진이 선호하는 구조(요약·표·FAQ)를 보강한다.`);
  }
  // 5) 경쟁 갭
  if (input.competitorAhead) {
    out.push(`경쟁 대응: '${input.competitorAhead}'가 앞선 질문에 비교·차별점 콘텐츠로 대응한다.`);
  }
  // 우위 유지(제안이 비었을 때)
  if (out.length === 0) {
    out.push("우위 유지: 신규 CEP(카테고리 진입점) 질문을 확장해 커버리지를 넓힌다.");
    out.push("외부 신뢰: 권위 있는 third-party 매체·리뷰에 일관된 브랜드 정보를 확보한다.");
  }

  return out.slice(0, 5);
}
