/**
 * 상권분석 데이터 엔진 — 오프라인 실측 데이터셋(행안부·심평원) 질의 계층.
 *
 * 원본 3종은 `data/`(git), 컴팩트 산출물은 `src/server/data/region/`(빌드: scripts/build-region-data.py).
 * 이 모듈은 그 산출물을 읽어 지역(시군구) 단위 실측 인사이트를 돌려준다.
 *   ① 인구·성별·증감(행안부)  ② 병원 밀집도·종별(심평원)  ③ 진료과 수요(심평원)  + 반경 밀집도
 *
 * 조인 키(canonical): `${시도축약}|${구정규화}` — 광주(전남 편입)·수원시 구 등 특수케이스 정규화 완료.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

import populationJson from "./region/population-by-sgg.json";
import hospitalsJson from "./region/hospitals-by-sgg.json";
import demandJson from "./region/demand-by-specialty.json";
import orientalJson from "./region/oriental-demand-by-sgg.json";
import frequentJson from "./region/frequent-diseases.json";
import openingsJson from "./region/openings-by-sgg.json";
import provinceJson from "./region/province-demand.json";
import diseaseDemoJson from "./region/disease-demographics.json";

export type RegionPopulation = {
  total: number;
  male: number;
  female: number;
  femaleRatio: number | null;
  delta: number; // 전월대비 증감(성장 모멘텀)
  dongs: number;
};
export type HospitalCounts = Record<string, number>; // 종별코드명 → 수
export type DemandRow = { code: string; patients: number; claims: number; days: number };

export type OrientalDx = { dx: string; patients: number; out: number; in: number };
export type OrientalDemand = { year: number; total: number; byDx: OrientalDx[] };

const population = populationJson as Record<string, RegionPopulation>;
const hospitals = hospitalsJson as Record<string, HospitalCounts>;
const demand = demandJson as Record<string, DemandRow[]>;
const oriental = orientalJson as Record<string, OrientalDemand>;

/** 시군구 한방 진료통계(주상병 대분류별 진료인원, 최신연도). 없으면 null. */
export function getOrientalDemand(key: string): OrientalDemand | null {
  return oriental[key] ?? null;
}

// 전국 다빈도 질병(3단 상병, 3년 추이) — 전체/한방.
export type FrequentDisease = { io: string; code: string; name: string; rank: number; y0: number; y1: number; y2: number; trend: number | null };
type FrequentFile = { years: { latest: number; prev: number; prev2: number }; data: Record<string, FrequentDisease[]> };
const frequent = frequentJson as FrequentFile;

export type FrequentKind = "전체" | "한방";
/** 전국 다빈도 상병(3년 추이). kind: 전체(양방 중심)·한방. */
export function getFrequentDiseases(kind: FrequentKind): { years: FrequentFile["years"]; rows: FrequentDisease[] } {
  return { years: frequent.years, rows: frequent.data[kind] ?? [] };
}

// 개원 추세(시군구별 최근 1년·3년 개원 수, 기준 2026-06-30) — 경쟁 심화 신호.
export type Openings = { y1: number; y3: number; total: number };
const openings = openingsJson as Record<string, Openings>;
export function getOpenings(key: string): Openings | null {
  return openings[key] ?? null;
}

// 양방 시도별 상병 수요(2024) + 상병별 성별×연령 타깃(2025).
export type ProvinceRow = { code: string; patients: number };
const province = provinceJson as Record<string, ProvinceRow[]>;
/** 시도(축약: 서울·부산…) 다빈도 상병(양방, 전 진료과). canonical key 의 시도부. */
export function getProvinceDemand(sido: string): ProvinceRow[] {
  return province[sido] ?? [];
}

// 진료과 → 관련 주상병(KCD 3단 접두). 광범위 진료과(내과·가정의학·소아 등)는 필터 없음(전체).
const SPECIALTY_CHAPTERS: Record<string, string[]> = {
  정형외과: ["M", "S", "T"],
  재활의학과: ["M", "S", "G8", "G9", "I6"],
  피부과: ["L"],
  성형외과: ["L", "S", "Q", "T"],
  안과: ["H0", "H1", "H2", "H3", "H4", "H5"],
  이비인후과: ["H6", "H7", "H8", "H9", "J0", "J3"],
  산부인과: ["N7", "N8", "N9", "O"],
  비뇨의학과: ["N0", "N1", "N2", "N3", "N4", "C6"],
  신경과: ["G"],
  정신건강의학과: ["F"],
  치과: ["K0", "K1"],
  외과: ["K3", "K4", "K5", "K6", "C"],
  신경외과: ["M4", "M5", "S1", "G"]
};
/** 진료과 관련 상병 판별자. 매핑 없으면 null(=전체 표시). */
export function specialtyCodePredicate(specialty: string | null | undefined): ((code: string) => boolean) | null {
  const ch = specialty ? SPECIALTY_CHAPTERS[specialty] : null;
  if (!ch) return null;
  return (code: string) => {
    const c = (code || "").trim().toUpperCase();
    return ch.some((p) => c.startsWith(p));
  };
}

export type DiseaseDemo = { total: number; male: number; female: number; femaleRatio: number | null; ageTop: { band: string; share: number }[] };
const diseaseDemo = diseaseDemoJson as Record<string, DiseaseDemo>;
/** 상병(3단코드) 성별×연령 타깃. 없으면 null. */
export function getDiseaseDemographics(code: string): DiseaseDemo | null {
  return diseaseDemo[code?.trim().slice(0, 3)] ?? null;
}

// ── 지역 정규화 ─────────────────────────────────────────────
const SIDO: { names: string[]; abbr: string }[] = [
  { names: ["서울특별시", "서울시", "서울"], abbr: "서울" },
  { names: ["부산광역시", "부산시", "부산"], abbr: "부산" },
  { names: ["대구광역시", "대구시", "대구"], abbr: "대구" },
  { names: ["인천광역시", "인천시", "인천"], abbr: "인천" },
  { names: ["광주광역시", "광주시", "광주"], abbr: "광주" },
  { names: ["대전광역시", "대전시", "대전"], abbr: "대전" },
  { names: ["울산광역시", "울산시", "울산"], abbr: "울산" },
  { names: ["세종특별자치시", "세종시", "세종"], abbr: "세종" },
  { names: ["경기도", "경기"], abbr: "경기" },
  { names: ["강원특별자치도", "강원도", "강원"], abbr: "강원" },
  { names: ["충청북도", "충북"], abbr: "충북" },
  { names: ["충청남도", "충남"], abbr: "충남" },
  { names: ["전북특별자치도", "전라북도", "전북"], abbr: "전북" },
  { names: ["전라남도", "전남"], abbr: "전남" },
  { names: ["경상북도", "경북"], abbr: "경북" },
  { names: ["경상남도", "경남"], abbr: "경남" },
  { names: ["제주특별자치도", "제주도", "제주"], abbr: "제주" }
];

/** 행안부 '수원시 장안구'식 표기를 병원파일 표기('수원장안구')로 통일. */
function normDistrict(d: string): string {
  return d.replace(/시\s/g, "").replace(/\s+/g, "").trim();
}

const KEYS = Object.keys(population);

export type RegionResolve = {
  key: string | null; // canonical (없으면 미해결)
  label: string; // 사람이 읽는 라벨(예: 광주 북구)
  candidates: { key: string; label: string }[]; // 모호할 때 후보
};

function labelOf(key: string): string {
  return key.replace("|", " ");
}

/**
 * 주소/지역 문자열 → canonical 시군구 키. 시도가 있으면 정확 파싱, 없으면 구명 포함 스캔.
 * 모호(예: '북구')하면 candidates 로 후보를 돌려준다.
 */
export function resolveRegionKey(input: string): RegionResolve {
  const s = (input || "").trim();
  if (!s) return { key: null, label: "", candidates: [] };

  // 1) 시도 접두 탐지(names 는 긴 이름 우선 정렬 → 첫 매칭 채택)
  let sidoAbbr = "";
  let rest = s;
  outer: for (const entry of SIDO) {
    for (const nm of entry.names) {
      if (s.startsWith(nm)) {
        sidoAbbr = entry.abbr;
        rest = s.slice(nm.length).trim();
        break outer;
      }
    }
  }

  // 2) 시군구 토큰 추출: 최대 2토큰(시 + 구) 결합
  if (sidoAbbr) {
    const toks = rest.split(/\s+/).filter(Boolean);
    for (let take = Math.min(2, toks.length); take >= 1; take--) {
      const cand = normDistrict(toks.slice(0, take).join(" "));
      const key = `${sidoAbbr}|${cand}`;
      if (population[key]) return { key, label: labelOf(key), candidates: [] };
    }
    // 시도만 맞고 구 미상 → 후보 없음(시도 전체 집계는 미지원)
  }

  // 3) 시도 없거나 파싱 실패 → 구명 부분 매칭 스캔(양방향)
  //    예: '마산' → '창원마산회원구'·'창원마산합포구'(창원 통합), '해운대' → '해운대구'
  const needle = normDistrict(s);
  const hits =
    needle.length >= 2
      ? KEYS.filter((k) => {
          const d = k.split("|")[1];
          return d && (needle.includes(d) || d.includes(needle));
        })
      : [];
  if (hits.length === 1) return { key: hits[0], label: labelOf(hits[0]), candidates: [] };
  if (hits.length > 1)
    return {
      key: null,
      label: s,
      candidates: hits.slice(0, 12).map((k) => ({ key: k, label: labelOf(k) }))
    };
  return { key: null, label: s, candidates: [] };
}

// ── ① 인구 ──────────────────────────────────────────────────
export function getRegionPopulation(key: string): RegionPopulation | null {
  return population[key] ?? null;
}

/** 전국 인구 만명당 병·의원 수(경쟁 강도 비교 기준선). 조인된 시군구 기준. */
let nationalPerCache: number | null = null;
export function nationalHospitalsPerTenThousand(): number {
  if (nationalPerCache != null) return nationalPerCache;
  let hos = 0;
  let pop = 0;
  for (const [key, counts] of Object.entries(hospitals)) {
    const p = population[key];
    if (!p?.total) continue;
    hos += Object.values(counts).reduce((a, b) => a + b, 0);
    pop += p.total;
  }
  nationalPerCache = pop ? Math.round((hos / pop) * 10000 * 10) / 10 : 0;
  return nationalPerCache;
}

// ── ② 병원 밀집도(시군구) ────────────────────────────────────
export type HospitalSummary = {
  counts: HospitalCounts;
  total: number;
  clinic: number; // 의원
  dental: number; // 치과의원
  oriental: number; // 한의원
  hospitalGrade: number; // 병원+종합+상급종합+요양+정신+한방병원 등 '병원급'
  clinicToOriental: number | null; // 의원:한의원 배수
  perTenThousand: number | null; // 인구 만명당 병·의원 수(인구 있을 때)
};

export function getRegionHospitals(key: string): HospitalSummary | null {
  const counts = hospitals[key];
  if (!counts) return null;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const clinic = counts["의원"] ?? 0;
  const dental = counts["치과의원"] ?? 0;
  const oriental = counts["한의원"] ?? 0;
  const gradeKeys = ["병원", "종합병원", "상급종합", "요양병원", "정신병원", "한방병원", "치과병원"];
  const hospitalGrade = gradeKeys.reduce((a, k) => a + (counts[k] ?? 0), 0);
  const pop = population[key];
  return {
    counts,
    total,
    clinic,
    dental,
    oriental,
    hospitalGrade,
    clinicToOriental: oriental ? Math.round((clinic / oriental) * 10) / 10 : null,
    perTenThousand: pop?.total ? Math.round((total / pop.total) * 10000 * 10) / 10 : null
  };
}

// ── ③ 진료과 수요 ────────────────────────────────────────────
export function listSpecialties(): string[] {
  return Object.keys(demand);
}
export function getDemandBySpecialty(specialty: string): DemandRow[] {
  return demand[specialty] ?? [];
}

// ── 반경 밀집도(개별 좌표) ───────────────────────────────────
type Points = {
  types: string[];
  keys: string[];
  t: number[];
  lat: number[];
  lng: number[];
  k: number[];
  n: string[];
};
let pointsCache: Points | null | undefined;

function loadPoints(): Points | null {
  if (pointsCache !== undefined) return pointsCache;
  try {
    const p = path.join(process.cwd(), "src/server/data/region/hospital-points.json.gz");
    pointsCache = JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString("utf-8")) as Points;
  } catch {
    pointsCache = null; // 배포에서 파일 미포함 시 반경 기능만 안전 강등
  }
  return pointsCache;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type RadiusResult = {
  total: number;
  byType: Record<string, number>;
  nearest: { name: string; type: string; distanceKm: number }[];
  points: { lat: number; lng: number; type: string }[]; // 지도 산점도용(반경 내 전체, 최대 400)
  available: boolean; // 좌표 데이터 로드 여부
};

/**
 * 반경 밀집도. 좌표(위경도) 기준 반경 km 내 병·의원 수·종별·최근접 목록.
 * @param typeFilter 특정 종별코드명(예: '치과의원')만 세려면 지정.
 */
export function radiusDensity(
  lat: number,
  lng: number,
  radiusKm = 1,
  typeFilter?: string
): RadiusResult {
  const pts = loadPoints();
  if (!pts) return { total: 0, byType: {}, nearest: [], points: [], available: false };
  const degLat = radiusKm / 111;
  const degLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const byType: Record<string, number> = {};
  const hits: { name: string; type: string; distanceKm: number }[] = [];
  const scatter: { lat: number; lng: number; type: string }[] = [];
  for (let i = 0; i < pts.lat.length; i++) {
    if (Math.abs(pts.lat[i] - lat) > degLat || Math.abs(pts.lng[i] - lng) > degLng) continue;
    const type = pts.types[pts.t[i]];
    if (typeFilter && type !== typeFilter) continue;
    const d = haversineKm(lat, lng, pts.lat[i], pts.lng[i]);
    if (d > radiusKm) continue;
    byType[type] = (byType[type] ?? 0) + 1;
    hits.push({ name: pts.n[i], type, distanceKm: Math.round(d * 100) / 100 });
    if (scatter.length < 400) scatter.push({ lat: pts.lat[i], lng: pts.lng[i], type });
  }
  hits.sort((a, b) => a.distanceKm - b.distanceKm);
  return { total: hits.length, byType, nearest: hits.slice(0, 20), points: scatter, available: true };
}

// ── 업체명 → 좌표 → 반경 밀집도 ──────────────────────────────
export type FacilityHit = { name: string; type: string; lat: number; lng: number };

/** 시군구(canonical key) 내에서 업체명으로 병·의원을 찾는다(부분일치, 최대 8건). */
export function findFacilitiesByName(regionKey: string, nameQuery: string): FacilityHit[] {
  const pts = loadPoints();
  if (!pts) return [];
  const ki = pts.keys.indexOf(regionKey);
  if (ki < 0) return [];
  const q = nameQuery.replace(/\s+/g, "");
  const hits: FacilityHit[] = [];
  for (let i = 0; i < pts.k.length && hits.length < 8; i++) {
    if (pts.k[i] !== ki) continue;
    if (q && !pts.n[i].replace(/\s+/g, "").includes(q)) continue;
    hits.push({ name: pts.n[i], type: pts.types[pts.t[i]], lat: pts.lat[i], lng: pts.lng[i] });
  }
  return hits;
}

export type FacilityRadius = {
  available: boolean;
  facility: FacilityHit | null;
  candidates: FacilityHit[]; // 이름이 여러 개 매칭될 때
  radiusKm: number;
  sameType: RadiusResult | null; // 동종 종별만
  all: RadiusResult | null; // 전체 병·의원
};

/**
 * 업체명(+지역)으로 좌표를 찾아 반경 밀집도 산출. 마케팅 대상 병원은 심평원 목록에 있으므로
 * 지오코딩 없이 반경 내 동종 경쟁·전체 병·의원을 실측한다.
 */
export function radiusForFacility(regionInput: string, name: string, radiusKm = 1): FacilityRadius {
  const { resolve } = getLocationInsight(regionInput);
  const empty: FacilityRadius = { available: false, facility: null, candidates: [], radiusKm, sameType: null, all: null };
  if (!resolve.key) return empty;
  const hits = findFacilitiesByName(resolve.key, name);
  if (hits.length === 0) return { ...empty, available: loadPoints() != null };
  if (hits.length > 1) return { available: true, facility: null, candidates: hits, radiusKm, sameType: null, all: null };
  const f = hits[0];
  return {
    available: true,
    facility: f,
    candidates: [],
    radiusKm,
    sameType: radiusDensity(f.lat, f.lng, radiusKm, f.type),
    all: radiusDensity(f.lat, f.lng, radiusKm)
  };
}

// ── 통합 인사이트 ────────────────────────────────────────────
export type LocationInsight = {
  resolve: RegionResolve;
  population: RegionPopulation | null;
  hospitals: HospitalSummary | null;
};

/** 지역 문자열 → ①인구 + ②병원 밀집도 통합(시군구 단위). */
export function getLocationInsight(regionInput: string): LocationInsight {
  const resolve = resolveRegionKey(regionInput);
  const key = resolve.key;
  return {
    resolve,
    population: key ? getRegionPopulation(key) : null,
    hospitals: key ? getRegionHospitals(key) : null
  };
}
