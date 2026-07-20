// GEO 통합 파이프라인 — 11단계 정의(단일 /geo 페이지의 상단 탭).
// 키워드 선택 등 기본 자료를 고르면 이후 단계로 자연스럽게 이어지도록 순서를 고정한다.
// (참고: 리스닝마인드형 CDJ 여정 — 초기탐색→브라우징→경험→구매확정→구매후→리텐션)

export type GeoStageKey =
  | "keyword"
  | "questions"
  | "citation"
  | "cep"
  | "journey"
  | "dashboard"
  | "content-diagnosis"
  | "plan"
  | "content"
  | "campaign"
  | "learning";

export type GeoStage = {
  key: GeoStageKey;
  step: number;
  label: string;
  desc: string;
};

export const GEO_STAGES: GeoStage[] = [
  { key: "keyword", step: 1, label: "키워드", desc: "메인·서브 키워드에서 연관키워드를 추출하고 검색량 30 이상만 선별합니다." },
  { key: "questions", step: 2, label: "질문", desc: "선별한 키워드와 관련된 소비자 질문(연관·관련 질문)을 추출합니다." },
  { key: "citation", step: 3, label: "4대 AI 인용", desc: "ChatGPT·Perplexity·Gemini·Claude 답변에서 병원 언급·인용을 측정합니다." },
  { key: "cep", step: 4, label: "CEP", desc: "카테고리 진입점(구매 계기)을 검색 의도 군집으로 발견합니다." },
  { key: "journey", step: 5, label: "여정", desc: "검색 전·후 경로를 키워드 네트워크로 분석합니다." },
  { key: "dashboard", step: 6, label: "통합 대시보드", desc: "고객여정(CDJ) 기반 통합 현황·KPI·SOV·월간 리포트." },
  { key: "content-diagnosis", step: 7, label: "콘텐츠 진단", desc: "기존 콘텐츠의 AI 인용 적합도(BLUF·FAQ·E-E-A-T)를 진단합니다." },
  { key: "plan", step: 8, label: "계획서", desc: "일·주·월·연간 GEO 실행 계획서를 작성합니다." },
  { key: "content", step: 9, label: "콘텐츠 생성", desc: "선별 질문·키워드 기반으로 답변형 콘텐츠를 생성합니다." },
  { key: "campaign", step: 10, label: "캠페인", desc: "채널·예산 믹스와 ROI를 추정하는 캠페인 플래너." },
  { key: "learning", step: 11, label: "학습", desc: "개입 성과를 학습해 스코어링 가중치를 개선합니다(버전 관리)." }
];

export const DEFAULT_GEO_STAGE: GeoStageKey = "dashboard";

export function isGeoStage(v: string | undefined | null): v is GeoStageKey {
  return !!v && GEO_STAGES.some((s) => s.key === v);
}

export function geoStageOf(v: string | undefined | null): GeoStageKey {
  return isGeoStage(v) ? v : DEFAULT_GEO_STAGE;
}
