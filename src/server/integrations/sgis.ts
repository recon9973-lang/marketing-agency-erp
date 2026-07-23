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
