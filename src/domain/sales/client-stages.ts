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

// ── Phase 4: 이벤트 기반 단계 자동 전환(제안) ──
// 데이터가 다음 단계 조건을 충족하면 전진을 "제안"한다(자동 이동 아님 — 사람 승인형 원칙).
export type StageSignals = {
  hasKeywords: boolean; // 키워드 등록됨 → 6단계 착수
  hasGeoMonitoring: boolean; // GEO 질문/관측 있음 → 7단계
  hasContentPlan: boolean; // 콘텐츠 기획 있음 → 8단계
  hasPublished: boolean; // 콘텐츠 발행됨 → 운영
};

/**
 * 현재 단계 + 신호 → 제안할 다음 단계(없으면 null).
 * 각 제안은 상태머신상 유효한 전진(canTransitionClientStage 보장). 활성 단계에서만 제안.
 */
export function suggestNextStage(stage: ClientStage, s: StageSignals): ClientStage | null {
  switch (stage) {
    case "ONBOARDING":
      return s.hasKeywords ? "KEYWORD" : null;
    case "KEYWORD":
      return s.hasGeoMonitoring ? "GEO" : null;
    case "GEO":
      return s.hasContentPlan ? "CONTENT" : null;
    case "CONTENT":
      return s.hasPublished ? "LIVE" : null;
    default:
      return null; // LIVE·PAUSED·CHURNED는 자동 제안 없음
  }
}

// ── Phase 5: 단계별 SLA(경과일 기준 지연 감지) ──
// 사장님 원칙: 계약 후 온보딩은 3일 내 킥오프. 단계별 목표 소요일을 넘기면 경고/지연 표시.
// 운영·중지·해지는 SLA 없음(상시 상태). 값 null = SLA 미적용.
export const STAGE_SLA_DAYS: Record<ClientStage, number | null> = {
  ONBOARDING: 3, // 배정 후 3일 내 킥오프·기준자료 착수
  KEYWORD: 7, // 키워드 수집·확정 1주
  GEO: 7, // 초기 GEO 관측 1주
  CONTENT: 14, // 첫 콘텐츠 배치 2주
  LIVE: null,
  PAUSED: null,
  CHURNED: null
};

export type SlaStatus = "ok" | "warn" | "breach";

export type StageSla = {
  daysInStage: number; // 현재 단계 진입 후 경과일(내림)
  limitDays: number | null; // 단계 SLA(없으면 null)
  status: SlaStatus; // ok=여유, warn=마감임박(마지막 하루), breach=지연
  overdueDays: number; // breach일 때 초과일(그 외 0)
};

const DAY_MS = 86_400_000;

/**
 * 현재 단계 진입 시각(since) 기준 경과일 → SLA 상태.
 * since 없으면(레거시·미기록) 지연으로 몰지 않도록 now를 넘겨 0일 처리.
 * 경계: breach = 경과일 ≥ 한도, warn = 마감 하루 전(경과일 = 한도-1).
 */
export function computeStageSla(stage: ClientStage, since: Date | null | undefined, now: Date): StageSla {
  const limit = STAGE_SLA_DAYS[stage];
  const base = since ?? now;
  const daysInStage = Math.max(0, Math.floor((now.getTime() - base.getTime()) / DAY_MS));
  if (limit == null) return { daysInStage, limitDays: null, status: "ok", overdueDays: 0 };
  if (daysInStage >= limit) return { daysInStage, limitDays: limit, status: "breach", overdueDays: daysInStage - limit };
  if (daysInStage >= limit - 1) return { daysInStage, limitDays: limit, status: "warn", overdueDays: 0 };
  return { daysInStage, limitDays: limit, status: "ok", overdueDays: 0 };
}
