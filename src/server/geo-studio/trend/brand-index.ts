// GEO Studio · P3 — 브랜드 검색지수 · 시계열 비교(리스닝마인드 "검색량+트렌드" 축소판).
// 데이터랩 상대지수(0~100)를 브랜드·카테고리·경쟁사 키워드별로 모아 시계열/과거비교를 산출.
// 스키마 무변경: 프로바이더 포트(searchVolume)만 사용 → 하이브리드 폴백·effectiveTier 그대로.
import type { SearchDataPort, VolumePoint } from "@/server/geo-studio/providers/port";

/** 키워드 1개의 시계열 + 과거비교 요약. */
export type TrendSeries = {
  keyword: string;
  role: "brand" | "category" | "competitor";
  points: VolumePoint[];
  latest: number | null; // 최근값(0~100)
  first: number | null; // 구간 첫값
  peak: number | null; // 구간 최고값
  deltaVsFirst: number | null; // 최근 - 첫값(구간 변화)
  deltaVsPrev: number | null; // 최근 - 직전(전월비)
  vsPeakPct: number | null; // 최근/최고 * 100(최고점 대비 현재 위치)
};

export type BrandTrendIndex = {
  series: TrendSeries[];
  brand: TrendSeries | null;
  periods: string[]; // 공통 x축(가장 긴 시계열 기준)
  hasData: boolean;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function summarize(keyword: string, role: TrendSeries["role"], points: VolumePoint[]): TrendSeries {
  if (points.length === 0) {
    return { keyword, role, points, latest: null, first: null, peak: null, deltaVsFirst: null, deltaVsPrev: null, vsPeakPct: null };
  }
  const vals = points.map((p) => p.value);
  const latest = vals[vals.length - 1];
  const first = vals[0];
  const prev = vals.length >= 2 ? vals[vals.length - 2] : null;
  const peak = Math.max(...vals);
  return {
    keyword,
    role,
    points,
    latest: round1(latest),
    first: round1(first),
    peak: round1(peak),
    deltaVsFirst: round1(latest - first),
    deltaVsPrev: prev != null ? round1(latest - prev) : null,
    vsPeakPct: peak > 0 ? Math.round((latest / peak) * 100) : null
  };
}

/**
 * 브랜드·카테고리·경쟁사 키워드의 검색지수 시계열을 모은다.
 * 각 키워드는 프로바이더 searchVolume(월)로 조회(실측=데이터랩, 미연동=목 폴백).
 * 개별 키워드 실패는 건너뛴다(부분 결과 허용).
 */
export async function buildBrandTrendIndex(
  provider: SearchDataPort,
  input: { brand: string; category: string; competitors?: string[] },
  opts?: { maxCompetitors?: number }
): Promise<BrandTrendIndex> {
  const maxComp = opts?.maxCompetitors ?? 3;
  const specs: Array<{ keyword: string; role: TrendSeries["role"] }> = [];
  if (input.brand.trim()) specs.push({ keyword: input.brand.trim(), role: "brand" });
  if (input.category.trim()) specs.push({ keyword: input.category.trim(), role: "category" });
  for (const c of (input.competitors ?? []).map((k) => k.trim()).filter(Boolean).slice(0, maxComp)) {
    specs.push({ keyword: c, role: "competitor" });
  }

  const series: TrendSeries[] = [];
  for (const spec of specs) {
    try {
      const points = await provider.searchVolume(spec.keyword, "m");
      series.push(summarize(spec.keyword, spec.role, points));
    } catch {
      // 개별 키워드 실패는 무시(부분 결과).
    }
  }

  const periods = series.reduce<string[]>((longest, s) => (s.points.length > longest.length ? s.points.map((p) => p.period) : longest), []);
  return {
    series,
    brand: series.find((s) => s.role === "brand") ?? null,
    periods,
    hasData: series.some((s) => s.points.length > 0)
  };
}
