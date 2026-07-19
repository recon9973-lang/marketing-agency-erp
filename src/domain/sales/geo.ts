// 목표 경로: src/domain/sales/geo.ts
//
// GEO(생성형 엔진 최적화) 모니터링 도메인 — 엔진 목록·질문 상태·질문 후보 템플릿.
// 원칙(기획서 §5-7, §7): AI 답변 출현은 "보장"이 아닌 모니터링 지표. 자동 스크래핑은
// 약관 확인 전 배제 — 담당자가 수동 실행 결과를 기록한다.

// 엔진 목록 — AI 노출 채널 전략 보고서의 4대 엔진(ChatGPT·Gemini·Claude·Perplexity)
// + 국내 병원 시장용 Google AI 오버뷰·네이버 AI.
export const GEO_ENGINES = ["CHATGPT", "PERPLEXITY", "GEMINI", "CLAUDE", "AI_OVERVIEW", "NAVER_AI"] as const;
export type GeoEngine = (typeof GEO_ENGINES)[number];

export const geoEngineLabels: Record<GeoEngine, string> = {
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  GEMINI: "Gemini",
  CLAUDE: "Claude",
  AI_OVERVIEW: "AI 오버뷰",
  NAVER_AI: "네이버 AI"
};

export const GEO_QUESTION_STATUSES = ["CANDIDATE", "APPROVED", "MONITORING", "RETIRED"] as const;
export type GeoQuestionStatus = (typeof GEO_QUESTION_STATUSES)[number];

export const geoQuestionStatusLabels: Record<GeoQuestionStatus, string> = {
  CANDIDATE: "후보",
  APPROVED: "승인",
  MONITORING: "모니터링",
  RETIRED: "종료"
};

export function isGeoEngine(value: string): value is GeoEngine {
  return (GEO_ENGINES as readonly string[]).includes(value);
}

/** 화면·리포트에 상시 노출하는 미보장 고지(기획서 §7 GEO 행). */
export const GEO_DISCLAIMER =
  "AI 답변 출현은 보장 지표가 아닌 모니터링 지표입니다. 엔진 정책·데이터에 따라 결과가 수시로 변동될 수 있습니다.";

// 질문 후보 템플릿 — {region} {department} 치환. 업무 매뉴얼(05) GEO 질문 SOP 준수:
// 병원명 홍보 질문이 아니라 환자의 진료 선택 기준·위험·회복·비용·방문 전 확인사항 중심.
// 5유형(정의형/판단형/비교형/위험형/지역형) × 4개 = 20개. AI 생성이 아닌 정적 템플릿(패널 결정 #8).
export type GeoQuestionType = "정의형" | "판단형" | "비교형" | "위험형" | "지역형" | "브랜드형" | "추천형" | "대안형";

const QUESTION_TEMPLATES: Array<{ type: GeoQuestionType; template: string; priority: number }> = [
  // 정의형 — 진료/시술 기본 설명 페이지로 연결
  { type: "정의형", template: "{department} 진료는 어떤 치료를 하나요?", priority: 3 },
  { type: "정의형", template: "{department}에서 주로 다루는 질환은 무엇인가요?", priority: 3 },
  { type: "정의형", template: "{department} 첫 진료는 어떻게 진행되나요?", priority: 3 },
  { type: "정의형", template: "{department} 검사는 어떤 종류가 있나요?", priority: 3 },
  // 판단형 — 방문 기준·응급/주의 신호 페이지
  { type: "판단형", template: "어떤 증상이 있으면 {department}에 가야 하나요?", priority: 2 },
  { type: "판단형", template: "{department} 진료가 필요한 위험 신호는 무엇인가요?", priority: 2 },
  { type: "판단형", template: "{department} 검진은 얼마나 자주 받아야 하나요?", priority: 3 },
  { type: "판단형", template: "{department} 방문 전에 준비하거나 확인할 사항은 무엇인가요?", priority: 3 },
  // 비교형 — 진료 선택 기준 페이지
  { type: "비교형", template: "{department} 의원과 대학병원 중 어디로 가야 하나요?", priority: 3 },
  { type: "비교형", template: "{department} 치료 방법에는 어떤 차이가 있나요?", priority: 3 },
  { type: "비교형", template: "{department} 병원을 고를 때 무엇을 비교해야 하나요?", priority: 2 },
  { type: "비교형", template: "{department} 비수술 치료와 수술 치료는 어떻게 다른가요?", priority: 3 },
  // 위험형 — 주의사항·상담 필요성 페이지
  { type: "위험형", template: "{department} 치료의 부작용이나 주의점은 무엇인가요?", priority: 2 },
  { type: "위험형", template: "{department} 치료 후 관리와 주의사항은 무엇인가요?", priority: 2 },
  { type: "위험형", template: "{department} 치료 회복 기간은 보통 얼마나 걸리나요?", priority: 3 },
  { type: "위험형", template: "{department} 진료 비용은 어떤 기준으로 정해지나요?", priority: 2 },
  // 지역형 — 병원 선택 체크리스트 페이지
  { type: "지역형", template: "{region}에서 {department} 병원을 고르는 기준은 무엇인가요?", priority: 1 },
  { type: "지역형", template: "{region}에서 {department} 야간·주말 진료는 어떻게 찾나요?", priority: 1 },
  { type: "지역형", template: "{region} {department} 진료 예약은 어떻게 하는 것이 좋나요?", priority: 2 },
  { type: "지역형", template: "{region}에서 {department} 방문 시 확인할 교통·주차 정보는 무엇인가요?", priority: 2 }
];

export type GeoQuestionCandidate = { question: string; priority: number; type: GeoQuestionType };

// 측정 특화 질의(GEO 실무 매뉴얼 §1 taxonomy: 브랜드·카테고리(추천)·대안).
// 콘텐츠용 20문과 별개로 "AI가 우리 브랜드를 뜨는가"를 직접 측정 — priority 1(최우선 관측).
// 근거: What Gets Cited(경쟁 GEO)·매뉴얼 — 브랜드/추천/대안 질의가 브랜드 가시성 측정의 핵심.
const DISCOVERY_TEMPLATES: Array<{ template: string; priority: number }> = [
  { template: "{region}에서 {department} 잘하는 병원 추천해줘", priority: 1 }, // 카테고리 발견(브랜드 무관)
  { template: "{region} {department} 어디가 좋아요?", priority: 1 },
  { template: "{department} 유명한 {region} 병원은 어디인가요?", priority: 2 }
];
const BRAND_TEMPLATES: Array<{ template: string; priority: number }> = [
  { template: "{hospitalName} 후기와 평판은 어떤가요?", priority: 1 }, // 브랜드 질의
  { template: "{region} {department} 중 {hospitalName}는 어떤 병원인가요?", priority: 1 }
];
const ALTERNATIVE_TEMPLATE = { template: "{competitor} 말고 {region} {department} 다른 곳 추천해줘", priority: 2 }; // 대안 질의

/**
 * 진료과·지역 기반 질문 후보 생성(정적 템플릿 치환).
 * - 기본 20문: 환자 진료선택 중심(콘텐츠 시드).
 * - opts.hospitalName/competitors 주면 측정 특화(브랜드·추천·대안) 질의를 priority 1로 추가.
 *   → 브랜드 가시성 측정의 핵심 질의를 최우선 관측 대상으로.
 */
// 확정 키워드 → GEO 질의 인계(carry-forward). 컨설팅·월보장 키워드를 자연어 발견 질의로 감싼다.
const KEYWORD_QUERY_TEMPLATE = "{keyword} 잘하는 곳 추천해줘";

export function buildGeoQuestionCandidates(
  department: string,
  region: string,
  opts?: { hospitalName?: string | null; competitors?: string[]; keywords?: string[] }
): GeoQuestionCandidate[] {
  const dept = department.trim() || "병원";
  const reg = region.trim() || "우리 지역";
  const fill = (t: string) =>
    t
      .replaceAll("{department}", dept)
      .replaceAll("{region}", reg)
      .replaceAll("{hospitalName}", (opts?.hospitalName ?? "").replace(/^\[[^\]]*\]\s*/, "").trim())
      .replaceAll("{competitor}", (opts?.competitors?.[0] ?? "").trim());

  const out: GeoQuestionCandidate[] = QUESTION_TEMPLATES.map(({ type, template, priority }) => ({
    question: fill(template),
    priority,
    type
  }));

  // 측정 특화 질의는 거래처 컨텍스트(opts)가 있을 때만 추가(2-인자 기본 호출은 콘텐츠 20문 유지).
  if (opts) {
    for (const d of DISCOVERY_TEMPLATES) out.push({ question: fill(d.template), priority: d.priority, type: "추천형" });
    const brand = (opts.hospitalName ?? "").replace(/^\[[^\]]*\]\s*/, "").trim();
    if (brand) for (const b of BRAND_TEMPLATES) out.push({ question: fill(b.template), priority: b.priority, type: "브랜드형" });
    if ((opts.competitors?.[0] ?? "").trim()) out.push({ question: fill(ALTERNATIVE_TEMPLATE.template), priority: ALTERNATIVE_TEMPLATE.priority, type: "대안형" });
    // 확정 키워드 인계 — 상위 키워드를 발견 질의로(중복·너무 짧은 것 제외).
    const seenKw = new Set<string>();
    for (const kw of opts.keywords ?? []) {
      const k = kw.trim();
      if (k.length < 2 || seenKw.has(k)) continue;
      seenKw.add(k);
      out.push({ question: KEYWORD_QUERY_TEMPLATE.replaceAll("{keyword}", k), priority: 1, type: "추천형" });
    }
  }

  return out;
}
