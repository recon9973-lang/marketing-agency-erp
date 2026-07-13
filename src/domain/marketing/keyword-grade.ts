// src/domain/marketing/keyword-grade.ts
//
// 키워드 검색량 A/B/C 등급 분류(네이버 6단계 ④). 순수함수 — 저장 없이 파생 계산 가능.
// 임계값은 스펙 예시(강남피부과 90,500=A, 여드름치료비용 33,100=A, 레이저토닝효과 18,200=B,
// 추천후기 8,900=B)에 맞춰 보정. 경쟁도는 참고 신호로 함께 반환(등급 강등엔 미사용, MVP).

export type KeywordGrade = "A" | "B" | "C";
export type KeywordCompetition = "low" | "medium" | "high";

export const GRADE_THRESHOLDS = { A: 20000, B: 3000 } as const;

/** 월간 검색량 → A/B/C. 검색량 미상(null)은 C로 보수 분류. */
export function gradeByVolume(searchVolume: number | null | undefined): KeywordGrade {
  const v = typeof searchVolume === "number" && Number.isFinite(searchVolume) ? searchVolume : 0;
  if (v >= GRADE_THRESHOLDS.A) return "A";
  if (v >= GRADE_THRESHOLDS.B) return "B";
  return "C";
}

export const gradeLabels: Record<KeywordGrade, string> = {
  A: "A(고검색·핵심)",
  B: "B(중검색·확장)",
  C: "C(저검색·롱테일)"
};

/** 등급 분포 집계(대시보드 KPI 타일용). */
export function gradeDistribution(volumes: Array<number | null | undefined>): Record<KeywordGrade, number> {
  const dist: Record<KeywordGrade, number> = { A: 0, B: 0, C: 0 };
  for (const v of volumes) dist[gradeByVolume(v)]++;
  return dist;
}
