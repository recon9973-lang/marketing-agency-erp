// src/domain/sales/client-lifecycle.ts
//
// 거래처(Account) 운영 생명주기 — 상태 표준(기획서 §12)과 전이 규칙.
// 온보딩 → 진단중 → 구축중 → 운영중 → 리포트대기 → 재계약대기 → 종료
// 규칙: 정상 전진 + 오입력 정정용 1단계 후진 허용. 종료 후 재개(운영중) 허용.

export const CLIENT_LIFECYCLE_STATUSES = [
  "ONBOARDING",
  "DIAGNOSING",
  "BUILDING",
  "OPERATING",
  "REPORT_PENDING",
  "RENEWAL_PENDING",
  "ENDED"
] as const;

export type ClientLifecycleStatus = (typeof CLIENT_LIFECYCLE_STATUSES)[number];

export const clientLifecycleLabels: Record<ClientLifecycleStatus, string> = {
  ONBOARDING: "온보딩",
  DIAGNOSING: "진단중",
  BUILDING: "구축중",
  OPERATING: "운영중",
  REPORT_PENDING: "리포트대기",
  RENEWAL_PENDING: "재계약대기",
  ENDED: "종료"
};

export const CLIENT_LIFECYCLE_TRANSITIONS: Record<ClientLifecycleStatus, ClientLifecycleStatus[]> = {
  ONBOARDING: ["DIAGNOSING", "ENDED"],
  DIAGNOSING: ["BUILDING", "ONBOARDING", "ENDED"],
  BUILDING: ["OPERATING", "DIAGNOSING", "ENDED"],
  OPERATING: ["REPORT_PENDING", "RENEWAL_PENDING", "BUILDING", "ENDED"],
  REPORT_PENDING: ["OPERATING", "RENEWAL_PENDING", "ENDED"],
  RENEWAL_PENDING: ["OPERATING", "ENDED"], // 재계약 성공→운영, 미갱신→종료
  ENDED: ["OPERATING"] // 재계약 재개
};

export function canTransitionClientLifecycle(from: ClientLifecycleStatus, to: ClientLifecycleStatus): boolean {
  return CLIENT_LIFECYCLE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isClientLifecycleStatus(v: unknown): v is ClientLifecycleStatus {
  return typeof v === "string" && (CLIENT_LIFECYCLE_STATUSES as readonly string[]).includes(v);
}
