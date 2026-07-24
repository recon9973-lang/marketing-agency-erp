// 기능 단위(메뉴) 접근 권한 — 사용자별로 특정 메뉴를 차단할 수 있다.
// 저장: User.deniedFeatures = 차단된 키 목록(string[]). 비어있으면 전체 허용.
// 최고관리자(SUPER_ADMIN)는 항상 전체 접근(차단 무시).
import { Role } from "./types";

export type FeatureKey =
  | "finance"
  | "contracts"
  | "leads"
  | "leave"
  | "geo"
  | "keywords"
  | "market"
  | "strategy"
  | "seo"
  | "worklog"
  | "manuscript"
  | "studio"
  | "magazine"
  | "compliance"
  | "ideas"
  | "meetings"
  | "vault";

export const CONTROLLABLE_FEATURES: { key: FeatureKey; label: string; href: string; group: string }[] = [
  // 영업·계약
  { key: "leads", label: "영업 리드", href: "/leads", group: "영업·계약" },
  { key: "contracts", label: "계약서", href: "/contracts", group: "영업·계약" },
  // 분석·GEO
  { key: "geo", label: "GEO", href: "/geo", group: "분석·GEO" },
  { key: "keywords", label: "검색량 조회", href: "/keywords", group: "분석·GEO" },
  { key: "market", label: "상권분석", href: "/market", group: "분석·GEO" },
  { key: "strategy", label: "마케팅 전략", href: "/strategy", group: "분석·GEO" },
  { key: "seo", label: "SEO 진단", href: "/seo", group: "분석·GEO" },
  { key: "worklog", label: "업무 보고", href: "/worklog", group: "분석·GEO" },
  // 제작
  { key: "manuscript", label: "원고 스튜디오", href: "/manuscript", group: "제작" },
  { key: "studio", label: "스튜디오", href: "/studio", group: "제작" },
  { key: "magazine", label: "매거진", href: "/magazine", group: "제작" },
  { key: "compliance", label: "의료법 검수", href: "/compliance", group: "제작" },
  { key: "ideas", label: "아이디어", href: "/ideas", group: "제작" },
  // 보고·결재
  { key: "meetings", label: "회의록", href: "/meetings", group: "보고·결재" },
  { key: "vault", label: "보관함", href: "/vault", group: "보고·결재" },
  // 관리
  { key: "finance", label: "재무/정산", href: "/finance", group: "관리" },
  { key: "leave", label: "연차/근태", href: "/leave", group: "관리" }
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
