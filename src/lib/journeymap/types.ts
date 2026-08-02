export type Stage = "exploration" | "comparison" | "decision" | "retention";
export type NodeKind = "center" | "branch" | "keyword";
export type RiskLevel = "none" | "yellow" | "red";
export type Source = "naver_ac" | "google_ac" | "naver_kin" | "google_paa" | "naver_rel" | "seed" | "user";

export interface RiskReason {
  ruleId: string;
  matched: string;
  law: string;
  description: string;
  suggestion: string;
}

export interface JNode {
  id: string;
  parentId: string | null;
  keyword: string;
  kind: NodeKind;
  depth: number; // 0=center, 1=branch, 2~=keyword
  stage: Stage | null;
  stageConfidence: number;
  stageOverridden: boolean;
  source: Source;
  score: number; // S_intent 0~100
  riskLevel: RiskLevel;
  riskReasons: RiskReason[];
  isBrand: boolean;
  collapsed: boolean;
  position?: { x: number; y: number };
  // 지표 (네이버 검색광고 API — 키 미설정 시 null)
  volumePc?: number | null;
  volumeMo?: number | null;
  cpc?: number | null; // 모바일 1위 예상 입찰가(원)
  competition?: string | null; // 낮음|중간|높음
  aiCorrected?: boolean; // LLM 분류 보정 여부
  sourceUrl?: string | null; // 지식iN 원본 질문 링크 등
  sourcesAll?: Source[]; // 이 키워드를 발견한 모든 소스 (교집합 분석용 실측)
  isLocal?: boolean; // PAA 질문의 지역 의존 여부 (지역→플레이스·랜딩 / 일반→블로그)
}

export interface HospitalProfile {
  name: string;
  departments: string[];
  regionSigungu: string;
  regionDong: string;
  mainTreatments: string[];
  targetAge: string;
  targetGender: string;
  competitors: string[];
}

export interface CollectOptions {
  sources: ("naver" | "google" | "kin")[];
  depth: 2 | 3 | 4;
  maxNodes: 100 | 200 | 400;
  useAi: boolean;
}

export type ProjectStatus = "draft" | "collecting" | "done" | "partial_done" | "failed";

export interface Project {
  id: string;
  mainKeyword: string;
  profile: HospitalProfile;
  seeds: string[];
  options: CollectOptions;
  status: ProjectStatus;
  nodes: JNode[];
  createdAt: number;
  updatedAt: number;
  sourceNote?: string;
}

export const STAGE_META: Record<Stage, { label: string; color: string; light: string }> = {
  exploration: { label: "① 탐색", color: "#2563eb", light: "#dbeafe" },
  comparison: { label: "② 비교", color: "#7c3aed", light: "#ede9fe" },
  decision: { label: "③ 결정", color: "#ea580c", light: "#ffedd5" },
  retention: { label: "④ 유지", color: "#16a34a", light: "#dcfce7" },
};

export const STAGES: Stage[] = ["exploration", "comparison", "decision", "retention"];

export function formatVolume(v: number | null | undefined): string {
  if (v == null) return "-";
  if (v >= 10000) return `${(v / 10000).toFixed(1)}만`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}천`;
  return String(v);
}
