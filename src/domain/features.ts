// 기능 단위(메뉴) 접근 권한 — 사용자별로 특정 메뉴를 차단할 수 있다.
// 저장: User.deniedFeatures = 차단된 키 목록(string[]). 비어있으면 전체 허용.
// 최고관리자(SUPER_ADMIN)는 항상 전체 접근(차단 무시).
import { Role } from "./types";

export type FeatureKey = "finance" | "contracts" | "leads" | "leave";

export const CONTROLLABLE_FEATURES: { key: FeatureKey; label: string; href: string }[] = [
  { key: "finance", label: "재무", href: "/finance" },
  { key: "contracts", label: "계약서", href: "/contracts" },
  { key: "leads", label: "영업 리드", href: "/leads" },
  { key: "leave", label: "근태/인사", href: "/leave" }
];

const FEATURE_KEYS = new Set<string>(CONTROLLABLE_FEATURES.map((f) => f.key));

/** 임의 값 → 유효한 기능 키 배열(방어적 파싱). */
export function parseFeatureKeys(value: unknown): FeatureKey[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is FeatureKey => typeof v === "string" && FEATURE_KEYS.has(v));
}

/** 이 사용자가 해당 기능을 쓸 수 있는지. 최고관리자는 항상 허용. */
export function canUseFeature(role: Role, deniedFeatures: readonly string[], key: FeatureKey): boolean {
  if (role === Role.SUPER_ADMIN) return true;
  return !deniedFeatures.includes(key);
}
