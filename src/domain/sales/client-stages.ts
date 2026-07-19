// 목표 경로: src/domain/sales/client-stages.ts
//
// 거래처 라이프사이클 파이프라인 — 계약 이후(5~8단계) 흐름의 백본.
// 리드 상태(lead-stages.ts, 1~4단계)가 WON으로 끝나면 거래처가 생기고, 여기서 이어받는다.
//   배정·착수 → 키워드 수집 → GEO 측정 → 콘텐츠 제작 → 운영
// Lead.status와 동일하게 Prisma enum이 아니라 String + 도메인 유니온으로 관리(코드베이스 규약).
// 규칙: 다음 단계로 전진, 오입력 정정용 1단계 후진 허용, 어느 단계서든 일시중지·해지 가능,
//       일시중지에서 활성 단계로 복귀, 해지에서 재개(ONBOARDING) 허용.

export const CLIENT_STAGES = [
  "ONBOARDING", // 5. 담당자 배정·착수
  "KEYWORD",    // 6. 키워드 수집
  "GEO",        // 7. GEO 측정
  "CONTENT",    // 8. 콘텐츠 제작·발행
  "LIVE",       // 정상 운영·월보장 관리
  "PAUSED",     // 일시중지(보류)
  "CHURNED"     // 해지·종료
] as const;

export type ClientStage = (typeof CLIENT_STAGES)[number];

export const clientStageLabels: Record<ClientStage, string> = {
  ONBOARDING: "배정·착수",
  KEYWORD: "키워드 수집",
  GEO: "GEO 측정",
  CONTENT: "콘텐츠 제작",
  LIVE: "운영",
  PAUSED: "일시중지",
  CHURNED: "해지"
};

/** 각 단계 한 줄 설명 — 파이프라인 화면 안내용. */
export const clientStageDescriptions: Record<ClientStage, string> = {
  ONBOARDING: "계약 완료 후 담당자 배정·킥오프. 기준 자료 수집을 시작합니다.",
  KEYWORD: "검색량·연관/관련 키워드·연관/관련 질문을 수집해 타깃을 확정합니다.",
  GEO: "AI 답변 노출(GEO)을 측정해 현재 인용/언급 상태를 파악합니다.",
  CONTENT: "확정된 키워드·GEO 기준으로 콘텐츠를 기획·제작·발행합니다.",
  LIVE: "정기 운영 — 월보장 순위·성과를 추적하고 콘텐츠를 이어갑니다.",
  PAUSED: "일시중지된 거래처입니다. 재개 시 진행 단계로 복귀합니다.",
  CHURNED: "종료된 거래처입니다."
};

/** 파이프라인 보드에 컬럼으로 펴는 활성 단계(중지·해지는 필터/요약칩). */
export const ACTIVE_CLIENT_STAGES: ClientStage[] = ["ONBOARDING", "KEYWORD", "GEO", "CONTENT", "LIVE"];

/** 진행률 계산용 선형 순서(0~4). 활성 5단계만 인덱스를 가진다. */
export const CLIENT_STAGE_ORDER: Record<ClientStage, number> = {
  ONBOARDING: 0,
  KEYWORD: 1,
  GEO: 2,
  CONTENT: 3,
  LIVE: 4,
  PAUSED: -1,
  CHURNED: -1
};

export const CLIENT_STAGE_TRANSITIONS: Record<ClientStage, ClientStage[]> = {
  ONBOARDING: ["KEYWORD", "PAUSED", "CHURNED"],
  KEYWORD: ["GEO", "ONBOARDING", "PAUSED", "CHURNED"],
  GEO: ["CONTENT", "KEYWORD", "PAUSED", "CHURNED"],
  CONTENT: ["LIVE", "GEO", "PAUSED", "CHURNED"],
  LIVE: ["CONTENT", "PAUSED", "CHURNED"], // 새 배치를 위해 콘텐츠로 되돌아갈 수 있음
  PAUSED: ["ONBOARDING", "KEYWORD", "GEO", "CONTENT", "LIVE", "CHURNED"], // 중단 지점으로 재개
  CHURNED: ["ONBOARDING"] // 재계약 시 처음부터
};

export function canTransitionClientStage(from: ClientStage, to: ClientStage): boolean {
  return CLIENT_STAGE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isClientStage(value: string): value is ClientStage {
  return (CLIENT_STAGES as readonly string[]).includes(value);
}

/** 안전 파싱 — 미상값은 ONBOARDING으로 폴백(레거시 데이터 방어). */
export function toClientStage(value: string | null | undefined): ClientStage {
  return value && isClientStage(value) ? value : "ONBOARDING";
}

/** 활성 5단계 기준 진행률(%) — PAUSED/CHURNED는 0. */
export function clientStageProgress(stage: ClientStage): number {
  const idx = CLIENT_STAGE_ORDER[stage];
  if (idx < 0) return 0;
  return Math.round((idx / (ACTIVE_CLIENT_STAGES.length - 1)) * 100);
}
