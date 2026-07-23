/**
 * SGIS(통계청 통계지리정보서비스) 인구통계 어댑터.
 *
 * 지역(시도/시군구/읍면동, 행정구역코드 adm_cd)별 인구·평균연령·세대수·인구밀도를 실측 조회한다.
 * 상권분석(location-auto)·거래처 인사이트의 '인구' 축을 업로드 대신 API 실측으로 채운다.
 *
 * env: SGIS_CONSUMER_KEY / SGIS_CONSUMER_SECRET (통계청 SGIS 오픈API 서비스 ID/키)
 * 인증: consumer_key/secret → accessToken(약 4시간, 캐시) → 통계 조회 시 accessToken 사용.
 * 문서: https://sgis.kostat.go.kr/developer/  (auth/authentication, stats/population)
 */
import "server-only";

const BASE = "https://sgisapi.kostat.go.kr/OpenAPI3";
const TIMEOUT_MS = 15_000;

export function sgisConfigured(): boolean {
  return Boolean(process.env.SGIS_CONSUMER_KEY && process.env.SGIS_CONSUMER_SECRET);
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// accessToken 캐시(인스턴스 내). SGIS accessTimeout(만료 epoch ms)까지 재사용.
let cached: { token: string; expiresAt: number } | null = null;

/** consumer_key/secret → accessToken. 미설정/실패 시 null. */
export async function getSgisToken(): Promise<string | null> {
  if (!sgisConfigured()) return null;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const key = encodeURIComponent(process.env.SGIS_CONSUMER_KEY as string);
  const secret = encodeURIComponent(process.env.SGIS_CONSUMER_SECRET as string);
  const j = await fetchJson(`${BASE}/auth/authentication.json?consumer_key=${key}&consumer_secret=${secret}`);
  const result = (j?.result ?? null) as Record<string, unknown> | null;
  const token = typeof result?.accessToken === "string" ? result.accessToken : null;
  if (!token) {
    console.warn("[sgis] 인증 실패:", String(j?.errMsg ?? "no token").slice(0, 120));
    return null;
  }
  const timeout = toNum(result?.accessTimeout);
  cached = { token, expiresAt: timeout && timeout > Date.now() ? timeout : Date.now() + 3.5 * 3600 * 1000 };
  return token;
}

export type RegionPopulation = {
  admCd: string;
  admNm: string;
  year: string;
  totalPopulation: number | null;
  avgAge: number | null;
  households: number | null;
  populationDensity: number | null;
  raw: Record<string, unknown>;
};

/**
 * 지역 인구통계(총인구·평균연령·세대수·인구밀도) 실측.
 * @param admCd 행정구역코드(시도 2자리 · 시군구 5자리 · 읍면동 8자리)
 * @param year  기준연도(미지정 시 전년도 — 통계 확정 여유)
 */
export async function fetchRegionPopulation(admCd: string, year?: string): Promise<RegionPopulation | null> {
  const token = await getSgisToken();
  if (!token) return null;
  const y = year || String(new Date().getFullYear() - 1);
  const url =
    `${BASE}/stats/population.json?accessToken=${encodeURIComponent(token)}` +
    `&year=${encodeURIComponent(y)}&adm_cd=${encodeURIComponent(admCd)}&low_search=0`;
  const j = await fetchJson(url);
  const rows = Array.isArray(j?.result) ? (j!.result as Record<string, unknown>[]) : [];
  const row = rows[0];
  if (!row) return null;
  return {
    admCd,
    admNm: typeof row.adm_nm === "string" ? row.adm_nm : "",
    year: y,
    totalPopulation: toNum(row.tot_ppltn),
    avgAge: toNum(row.avg_age),
    households: toNum(row.tot_house ?? row.tot_family),
    populationDensity: toNum(row.ppltn_dnsty),
    raw: row
  };
}

// ── 성별·연령 분해 조회 ───────────────────────────────────────────────
// SGIS population.json 은 gender(1남/2여)·age_from/age_to 필터를 받아
// 해당 조건의 tot_ppltn 을 돌려준다. 분해값은 반드시 교차검증한다:
//   · 남+여 ≈ 총계   · 연령대 합 ≈ 총계   (오차 3% 이내일 때만 채택)
// 검증 실패(파라미터 미지원·응답형상 변화 등) 시 조용히 null/빈배열로 강등한다.
// → 스킬 절대원칙 "실측>추론>날조 금지": 못 맞추면 채우지 않는다.

/** population.json 을 임의 필터로 호출해 결과 rows 를 돌려준다(실패 시 빈 배열). */
async function fetchPopulationRows(
  token: string,
  params: Record<string, string>
): Promise<Record<string, unknown>[]> {
  const qs = new URLSearchParams({ accessToken: token, ...params }).toString();
  const j = await fetchJson(`${BASE}/stats/population.json?${qs}`);
  return Array.isArray(j?.result) ? (j!.result as Record<string, unknown>[]) : [];
}

/** rows 첫 행의 tot_ppltn(인구 수). */
function popOf(rows: Record<string, unknown>[]): number | null {
  return rows.length ? toNum(rows[0].tot_ppltn) : null;
}

// 병원마케팅 핵심 연령대(10대~60대+). 20·30·40대가 다이어트·피부·성형 코어층.
const AGE_BANDS: { label: string; from: number; to: number }[] = [
  { label: "10대 이하", from: 0, to: 19 },
  { label: "20대", from: 20, to: 29 },
  { label: "30대", from: 30, to: 39 },
  { label: "40대", from: 40, to: 49 },
  { label: "50대", from: 50, to: 59 },
  { label: "60대 이상", from: 60, to: 120 }
];

export type AgeBand = { label: string; population: number; ratio: number };

export type RegionDemographics = {
  admCd: string;
  admNm: string;
  year: string;
  total: number | null;
  male: number | null;
  female: number | null;
  /** 여성 비중 %(남+여 교차검증 통과 시에만). */
  femaleRatio: number | null;
  /** 성별 분해가 교차검증을 통과했는가. */
  genderResolved: boolean;
  /** 연령대 분포(합≈총계 검증 통과 시). 미해결이면 빈 배열. */
  ageBands: AgeBand[];
  /** 20~30대 여성 인구(성별×연령 교차 실측). 병원마케팅 코어 타깃. */
  femaleCore2039: number | null;
  ageResolved: boolean;
  raw: Record<string, unknown>;
};

const TOL = 0.03; // 교차검증 허용 오차(3%)

/**
 * 지역 성별·연령 분해 인구 실측. 총계 + 남/여 + 연령대 분포 + 20·30대 여성 코어.
 * 각 분해축은 독립 교차검증하여, 통과한 축만 값을 담고 나머지는 null/빈배열로 강등.
 * (SGIS 키 미설정·인증 실패 시 전체 null.)
 */
export async function fetchRegionDemographics(admCd: string, year?: string): Promise<RegionDemographics | null> {
  const token = await getSgisToken();
  if (!token) return null;
  const y = year || String(new Date().getFullYear() - 1);
  const base = { year: y, adm_cd: admCd, low_search: "0" };

  // 총계 + 남 + 여 + 연령대별 + (여성×20~30대) 병렬 조회.
  const [baseRows, maleRows, femaleRows, femCoreRows, ...bandRowsList] = await Promise.all([
    fetchPopulationRows(token, base),
    fetchPopulationRows(token, { ...base, gender: "1" }),
    fetchPopulationRows(token, { ...base, gender: "2" }),
    fetchPopulationRows(token, { ...base, gender: "2", age_from: "20", age_to: "39" }),
    ...AGE_BANDS.map((b) => fetchPopulationRows(token, { ...base, age_from: String(b.from), age_to: String(b.to) }))
  ]);

  const baseRow = baseRows[0];
  if (!baseRow) return null;
  const total = toNum(baseRow.tot_ppltn);

  // ── 성별 교차검증: 남+여 ≈ 총계 ──
  const male = popOf(maleRows);
  const female = popOf(femaleRows);
  let genderResolved = false;
  if (total && male != null && female != null && Math.abs(male + female - total) <= total * TOL) {
    genderResolved = true;
  }

  // ── 연령대 교차검증: 밴드 합 ≈ 총계 ──
  const bandPops = bandRowsList.map((rows) => popOf(rows));
  let ageResolved = false;
  let ageBands: AgeBand[] = [];
  if (total && bandPops.every((p) => p != null)) {
    const sum = bandPops.reduce((s, p) => s + (p as number), 0);
    // 밴드가 필터를 무시하면 각 값이 총계와 같아져 sum≫총계 → 검증 실패로 걸러짐.
    if (Math.abs(sum - total) <= total * TOL) {
      ageResolved = true;
      ageBands = AGE_BANDS.map((b, i) => ({
        label: b.label,
        population: bandPops[i] as number,
        ratio: total ? Math.round(((bandPops[i] as number) / total) * 1000) / 10 : 0
      }));
    }
  }

  // ── 20~30대 여성 코어: 여성 총계보다 크지 않아야 유효 ──
  const femCore = popOf(femCoreRows);
  const femaleCore2039 =
    genderResolved && femCore != null && female != null && femCore <= female * (1 + TOL) ? femCore : null;

  return {
    admCd,
    admNm: typeof baseRow.adm_nm === "string" ? baseRow.adm_nm : "",
    year: y,
    total,
    male: genderResolved ? male : null,
    female: genderResolved ? female : null,
    femaleRatio: genderResolved && total ? Math.round((female! / total) * 1000) / 10 : null,
    genderResolved,
    ageBands,
    femaleCore2039,
    ageResolved,
    raw: baseRow
  };
}

/**
 * 주소/지명 → 행정구역코드(adm_cd) 변환(지오코딩). 인구 조회 전 코드 확보용.
 * 반환: 최상위 후보의 { admCd, admNm } (없으면 null).
 */
export async function resolveAdmCode(query: string): Promise<{ admCd: string; admNm: string } | null> {
  const token = await getSgisToken();
  if (!token || !query.trim()) return null;
  const geo = await fetchJson(
    `${BASE}/addr/geocode.json?accessToken=${encodeURIComponent(token)}&address=${encodeURIComponent(query)}`
  );
  const result = (geo?.result ?? null) as { resultdata?: unknown } | null;
  const list = Array.isArray(result?.resultdata) ? (result!.resultdata as Record<string, unknown>[]) : [];
  const first = list[0];
  if (first && typeof first.adm_cd === "string") {
    return { admCd: first.adm_cd, admNm: typeof first.adm_nm === "string" ? first.adm_nm : query };
  }
  return null;
}
