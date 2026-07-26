// GEO 진단 파이프라인 — 9단계 정의(단일 /geo 페이지의 상단 탭).
// 키워드 발굴·검색여정 분석은 "키워드 여정맵"(/journeymap)으로 일원화되어 단계에서 제거됨.
// 모니터링(관측 추이)은 /geo-monitor 로 분리됨 — 워크플로우 마지막 단계.
// (참고: 리스닝마인드형 CDJ 여정 — 초기탐색→브라우징→경험→구매확정→구매후→리텐션)

export type GeoStageKey =
  | "questions"
  | "citation"
  | "cep"
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
  { key: "questions", step: 1, label: "질문", desc: "키워드 여정맵에서 발굴한 키워드로 소비자 질문(연관·관련 질문)을 추출합니다." },
  { key: "citation", step: 2, label: "4대 AI 인용", desc: "ChatGPT·Perplexity·Gemini·Claude 답변에서 병원 언급·인용을 측정합니다." },
  { key: "cep", step: 3, label: "CEP", desc: "카테고리 진입점(구매 계기)을 검색 의도 군집으로 발견합니다." },
  { key: "dashboard", step: 4, label: "진단 대시보드", desc: "GEO 점수·기회점수·전략 방향 등 진단 결과 요약." },
  { key: "content-diagnosis", step: 5, label: "콘텐츠 진단", desc: "URL 또는 본문의 AI 인용 적합도(BLUF·FAQ·E-E-A-T)를 진단합니다." },
  { key: "plan", step: 6, label: "계획서", desc: "일·주·월·연간 GEO 실행 계획서를 작성합니다." },
  { key: "content", step: 7, label: "콘텐츠 생성", desc: "선별 질문·키워드 기반으로 답변형 콘텐츠를 생성합니다." },
  { key: "campaign", step: 8, label: "캠페인", desc: "채널·예산 믹스와 ROI를 추정하는 캠페인 플래너." },
  { key: "learning", step: 9, label: "학습", desc: "개입 성과를 학습해 스코어링 가중치를 개선합니다(버전 관리)." }
];

export const DEFAULT_GEO_STAGE: GeoStageKey = "dashboard";

export function isGeoStage(v: string | undefined | null): v is GeoStageKey {
  return !!v && GEO_STAGES.some((s) => s.key === v);
}

export function geoStageOf(v: string | undefined | null): GeoStageKey {
  return isGeoStage(v) ? v : DEFAULT_GEO_STAGE;
}
