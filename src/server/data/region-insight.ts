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

const population = populationJson as Record<string, RegionPopulation>;
const hospitals = hospitalsJson as Record<string, HospitalCounts>;
const demand = demandJson as Record<string, DemandRow[]>;

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

  // 3) 시도 없거나 파싱 실패 → 구명 포함 스캔
  const needle = normDistrict(s);
  const hits = KEYS.filter((k) => {
    const d = k.split("|")[1];
    return d && needle.includes(d);
  });
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
  if (!pts) return { total: 0, byType: {}, nearest: [], available: false };
  const degLat = radiusKm / 111;
  const degLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const byType: Record<string, number> = {};
  const hits: { name: string; type: string; distanceKm: number }[] = [];
  for (let i = 0; i < pts.lat.length; i++) {
    if (Math.abs(pts.lat[i] - lat) > degLat || Math.abs(pts.lng[i] - lng) > degLng) continue;
    const type = pts.types[pts.t[i]];
    if (typeFilter && type !== typeFilter) continue;
    const d = haversineKm(lat, lng, pts.lat[i], pts.lng[i]);
    if (d > radiusKm) continue;
    byType[type] = (byType[type] ?? 0) + 1;
    hits.push({ name: pts.n[i], type, distanceKm: Math.round(d * 100) / 100 });
  }
  hits.sort((a, b) => a.distanceKm - b.distanceKm);
  return { total: hits.length, byType, nearest: hits.slice(0, 20), available: true };
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
