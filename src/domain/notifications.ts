// 알림 분류 — type 문자열을 통합 알림센터의 카테고리/색/아이콘으로 매핑(순수, 클라이언트 공용).
// 새 type이 생겨도 키워드 규칙으로 흡수되며, 매칭 실패 시 SYSTEM(기타)로 안전 강등.

export type NotifCategory = "RANK" | "CONFIRM" | "CLIENT" | "COLLAB" | "HR" | "SYSTEM";
export type NotifTone = "rose" | "amber" | "blue" | "violet" | "emerald" | "slate";
export type NotifIcon = "rank" | "confirm" | "client" | "collab" | "hr" | "system";

export const NOTIF_CATEGORY_LABEL: Record<NotifCategory, string> = {
  RANK: "순위·성과",
  CONFIRM: "컨펌·승인",
  CLIENT: "거래처",
  COLLAB: "협업",
  HR: "근태",
  SYSTEM: "기타"
};

// 필터 탭 노출 순서.
export const NOTIF_CATEGORY_ORDER: NotifCategory[] = ["RANK", "CONFIRM", "CLIENT", "COLLAB", "HR", "SYSTEM"];

export type NotifMeta = { category: NotifCategory; tone: NotifTone; icon: NotifIcon };

const META: Record<NotifCategory, NotifMeta> = {
  RANK: { category: "RANK", tone: "rose", icon: "rank" },
  CONFIRM: { category: "CONFIRM", tone: "amber", icon: "confirm" },
  CLIENT: { category: "CLIENT", tone: "blue", icon: "client" },
  COLLAB: { category: "COLLAB", tone: "violet", icon: "collab" },
  HR: { category: "HR", tone: "emerald", icon: "hr" },
  SYSTEM: { category: "SYSTEM", tone: "slate", icon: "system" }
};

/** 알림 type → 카테고리 메타. 순서 있는 키워드 규칙(먼저 매칭되는 것이 우선). */
export function classifyNotification(type: string): NotifMeta {
  const t = (type || "").toUpperCase();
  if (t.includes("RANK") || t.includes("EXPOSURE") || t.includes("GUARD")) return META.RANK;
  if (t.includes("APPROVAL") || t.includes("CONFIRM") || t.includes("REVIEW")) return META.CONFIRM;
  if (t.includes("CLIENT") || t.includes("FEEDBACK") || t.includes("SURVEY") || t.includes("PORTAL")) return META.CLIENT;
  if (t.includes("MENTION") || t.includes("COMMENT") || t.includes("WORK") || t.includes("ASSIGN")) return META.COLLAB;
  if (t.includes("LEAVE") || t.includes("VACATION") || t.includes("HR")) return META.HR;
  return META.SYSTEM;
}
