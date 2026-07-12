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
export type GeoQuestionType = "정의형" | "판단형" | "비교형" | "위험형" | "지역형";

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

/**
 * 진료과·지역 기반 질문 후보 20개 생성(정적 템플릿 치환).
 * 지역형은 우선순위 1~2(로컬 의도), 판단·위험형 2, 정의·비교형 3.
 */
export function buildGeoQuestionCandidates(department: string, region: string): GeoQuestionCandidate[] {
  const dept = department.trim() || "병원";
  const reg = region.trim() || "우리 지역";
  return QUESTION_TEMPLATES.map(({ type, template, priority }) => ({
    question: template.replaceAll("{department}", dept).replaceAll("{region}", reg),
    priority,
    type
  }));
}
