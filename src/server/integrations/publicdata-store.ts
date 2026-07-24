import "server-only";
/**
 * 소상공인시장진흥공단 상가(상권)정보 API — 반경 내 상가업소(점포) 밀도·업종 분포.
 * 상권 활성도(유동인구 근사) 축. 병원 좌표 반경의 상업 활성도를 실측한다.
 *
 * env: PUBLICDATA_SERVICE_KEY (공공데이터포털 일반 인증키 · Decoding 키 권장)
 * base: https://apis.data.go.kr/B553077/api/open/sdsc2
 * 주의: 이 API는 조직 egress 정책에 따라 차단될 수 있음(apis.data.go.kr). 실패 시 null 강등.
 */
const BASE = "https://apis.data.go.kr/B553077/api/open/sdsc2";
const TIMEOUT_MS = 9000;

export function publicDataConfigured(): boolean {
  return Boolean(process.env.PUBLICDATA_SERVICE_KEY);
}

export type StoreDensity = {
  total: number; // 반경 내 상가업소 총수(totalCount)
  radiusM: number;
  byCategory: { name: string; count: number }[]; // 상권업종 대분류 분포(표본 기반)
  sampled: number; // 분포 산출에 사용한 표본 수
};

function num(v: unknown): number {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * 반경 내 상가업소 밀도·업종 분포. cx=경도, cy=위도, radius(m, 최대 1000 권장).
 * 미설정/차단/오류 시 null(안전 강등).
 */
export async function storeDensityInRadius(cx: number, cy: number, radiusM = 500): Promise<StoreDensity | null> {
  const key = process.env.PUBLICDATA_SERVICE_KEY;
  if (!key || !Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const qs = new URLSearchParams({
    serviceKey: key,
    radius: String(Math.min(1000, Math.max(50, radiusM))),
    cx: String(cx),
    cy: String(cy),
    type: "json",
    numOfRows: "200",
    pageNo: "1"
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/storeListInRadius?${qs.toString()}`, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    const body = ((j.body ?? (j as { response?: { body?: unknown } }).response?.body) ?? null) as Record<string, unknown> | null;
    if (!body) return null;
    const total = num(body.totalCount);
    const rawItems = body.items;
    const items: Record<string, unknown>[] = Array.isArray(rawItems)
      ? (rawItems as Record<string, unknown>[])
      : Array.isArray((rawItems as { item?: unknown })?.item)
        ? ((rawItems as { item: Record<string, unknown>[] }).item)
        : [];
    const cat = new Map<string, number>();
    for (const it of items) {
      // 상권업종 대분류명(응답 필드명 변형 대비 다중 후보).
      const name =
        (it.indsLclsNm as string) || (it.ctgryLrgNm as string) || (it.categoryLarge as string) || "기타";
      cat.set(name, (cat.get(name) ?? 0) + 1);
    }
    const byCategory = [...cat.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    return { total: total || items.length, radiusM, byCategory, sampled: items.length };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
