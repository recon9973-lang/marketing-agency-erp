// src/domain/sales/risk.ts
//
// 리스크 상태 표준(기획서 §12)과 전이 규칙 + 심각도 점수.
// 감지 → 담당자확인 → 수정중 → 재검수 → 해소 → 보관
// 규칙: 정상 전진 + REVIEW→FIXING 반려, RESOLVED→DETECTED 재발 허용.

export const RISK_STATUSES = ["DETECTED", "CONFIRMED", "FIXING", "REVIEW", "RESOLVED", "ARCHIVED"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export const riskStatusLabels: Record<RiskStatus, string> = {
  DETECTED: "감지",
  CONFIRMED: "담당자확인",
  FIXING: "수정중",
  REVIEW: "재검수",
  RESOLVED: "해소",
  ARCHIVED: "보관"
};

export const RISK_TRANSITIONS: Record<RiskStatus, RiskStatus[]> = {
  DETECTED: ["CONFIRMED", "ARCHIVED"],
  CONFIRMED: ["FIXING", "ARCHIVED"],
  FIXING: ["REVIEW", "ARCHIVED"],
  REVIEW: ["RESOLVED", "FIXING"], // 재검수 실패 시 수정중으로 반려
  RESOLVED: ["ARCHIVED", "DETECTED"], // 재발 시 재감지
  ARCHIVED: []
};

/** 미해소(=완료/종료 게이트에 걸리는) 상태. */
export const OPEN_RISK_STATUSES: RiskStatus[] = ["DETECTED", "CONFIRMED", "FIXING", "REVIEW"];

export type RiskSeverity = "low" | "medium" | "high";

/** 계정 리스크 점수 가중 — 심각도 기반. */
export function severityScore(severity: RiskSeverity): number {
  return severity === "high" ? 3 : severity === "medium" ? 2 : 1;
}

export function canTransitionRisk(from: RiskStatus, to: RiskStatus): boolean {
  return RISK_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isOpenRisk(status: string): boolean {
  return (OPEN_RISK_STATUSES as readonly string[]).includes(status);
}

export function isRiskStatus(v: unknown): v is RiskStatus {
  return typeof v === "string" && (RISK_STATUSES as readonly string[]).includes(v);
}
