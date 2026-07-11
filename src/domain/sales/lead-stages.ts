// 목표 경로: src/domain/sales/lead-stages.ts
//
// 영업 리드 파이프라인 — 상태 표준(기획서 §12)과 전이 규칙.
// 신규 → 접촉중 → 무료진단 → 미팅예정 → 제안발송 → 계약성공/실패 → 재접촉예약
// 규칙: WON은 터미널(거래처 전환만 허용), LOST→RECONTACT 허용, 오입력 정정용 1단계 후진 허용,
//       CONTACTING→PROPOSAL은 진단 생략 케이스로 허용. 2단계 이상 점프 금지.

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTING",
  "AUDIT",
  "MEETING",
  "PROPOSAL",
  "WON",
  "LOST",
  "RECONTACT"
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const leadStatusLabels: Record<LeadStatus, string> = {
  NEW: "신규",
  CONTACTING: "접촉중",
  AUDIT: "무료진단",
  MEETING: "미팅예정",
  PROPOSAL: "제안발송",
  WON: "계약성공",
  LOST: "계약실패",
  RECONTACT: "재접촉예약"
};

/** 보드에 컬럼으로 펴는 활성 단계(종결·재접촉은 요약칩/필터로). */
export const ACTIVE_LEAD_STAGES: LeadStatus[] = ["NEW", "CONTACTING", "AUDIT", "MEETING", "PROPOSAL"];

export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["CONTACTING", "LOST"],
  CONTACTING: ["AUDIT", "PROPOSAL", "NEW", "LOST", "RECONTACT"],
  AUDIT: ["MEETING", "CONTACTING", "LOST", "RECONTACT"],
  MEETING: ["PROPOSAL", "AUDIT", "LOST", "RECONTACT"],
  PROPOSAL: ["WON", "MEETING", "LOST", "RECONTACT"],
  WON: [], // 터미널 — 거래처 전환만 허용
  LOST: ["RECONTACT"],
  RECONTACT: ["CONTACTING"]
};

export function canTransitionLead(from: LeadStatus, to: LeadStatus): boolean {
  return LEAD_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

/** 무료진단 체크리스트 — 기획서 §11 초기 진단 8항목. */
export const AUDIT_CHECKLIST_ITEMS = [
  { key: "indexing", label: "색인(검색 노출) 상태" },
  { key: "meta", label: "title/description 메타" },
  { key: "sitemap", label: "사이트맵 제출" },
  { key: "robots", label: "robots.txt 정상" },
  { key: "mobile", label: "모바일 최적화" },
  { key: "structure", label: "진료과 페이지 구조" },
  { key: "cta", label: "전화/예약 CTA" },
  { key: "profile", label: "플레이스/비즈니스 프로필" }
] as const;

export type AuditChecklist = Partial<Record<(typeof AUDIT_CHECKLIST_ITEMS)[number]["key"], boolean>>;

/** 체크리스트 → 100점 만점 자동 점수(통과 항목 비율). */
export function computeAuditScore(checklist: AuditChecklist): number {
  const total = AUDIT_CHECKLIST_ITEMS.length;
  const passed = AUDIT_CHECKLIST_ITEMS.filter((item) => checklist[item.key] === true).length;
  return Math.round((passed / total) * 100);
}

/** 개인정보 수집 동의 고지문 — 버전과 함께 consentTextVersion으로 저장(§15 방어). */
export const LEAD_CONSENT_TEXT_VERSION = "v1-2026-07";
export const LEAD_CONSENT_TEXT =
  "수집 목적: 무료진단 및 마케팅 상담 / 수집 항목: 담당자명·연락처·이메일 / 보유 기간: 동의 철회 또는 목적 달성 시까지 / " +
  "귀하는 동의를 거부할 수 있으며, 거부 시 무료진단 신청이 제한됩니다.";
