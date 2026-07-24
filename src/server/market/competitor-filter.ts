/**
 * 경쟁사 표본 선별 — 네이버 지역검색 원시 결과에서 자기병원·명백한 이종을 제외하고
 * 진료과 관련 상호를 앞으로 정렬한다. (상권분석 /market · 마케팅전략 /strategy 공용)
 *
 * 설계 원칙:
 * - 네이버 지역검색 OpenAPI는 질의당 최대 5건만 반환(하드 상한). 지도앱과 달리 API 상한임.
 * - 질의에 이미 "지역 + 진료과"가 포함돼 결과가 관련순으로 정렬돼 있으므로,
 *   진료과 글자 완전일치로 "제외"하면 ○○의원 형태의 실제 동종까지 떨어진다.
 *   → 완전일치는 정렬 우선순위로만 쓰고, 제외는 자기병원 + 명백한 이종만.
 */
import type { LocalPlace } from "@/server/integrations/naver-local";

const CLINIC_SUFFIX = /(의원|병원|치과|한의원|한방병원|클리닉|clinic|centre|center)$/i;

/** 상호 정규화(공백·의료기관 접미어 제거) — 자기병원 판별용. */
export function normalizeName(s: string): string {
  return s.replace(/\s+/g, "").replace(CLINIC_SUFFIX, "").toLowerCase();
}

// 명백한 비임상/이종 업종 — 진료과 경쟁사에서 제외.
const OFFTOPIC = /(피부관리|에스테틱|네일|왁싱|미용실|헤어|마사지|스파|약국|동물병원|요양병원|산후조리|필라테스|헬스|체육관)/;

function isOffTopic(place: LocalPlace, specialty: string | null): boolean {
  const hay = `${place.category} ${place.name}`;
  if (OFFTOPIC.test(hay)) return true;
  const sp = (specialty || "").replace(/\s+/g, "");
  // 한방·치과는 해당 진료과를 조회한 게 아닐 때만 이종으로 제외.
  if (sp && sp !== "치과" && /치과/.test(place.category)) return true;
  if (sp && !/한/.test(sp) && /(한의원|한방)/.test(place.category)) return true;
  return false;
}

/** 자기병원 여부(정규화 상호 상호포함). brand 없으면 항상 false. */
export function isOwnBrand(name: string, brand: string | null): boolean {
  const b = brand ? normalizeName(brand) : "";
  if (b.length < 2) return false;
  const n = normalizeName(name);
  return n.length >= 2 && (n === b || n.includes(b) || b.includes(n));
}

/**
 * 경쟁사 표본 선별. raw(네이버 원시) → 자기병원·이종 제외 → 진료과 관련 우선 정렬 → 상위 limit.
 * @returns places(선별 결과) · filtered(진료과 정렬이 실제로 순위를 바꿨는지)
 */
export function selectCompetitors(
  raw: LocalPlace[],
  opts: { specialty?: string | null; brand?: string | null; limit?: number } = {}
): { places: LocalPlace[]; filtered: boolean } {
  const { specialty = null, brand = null, limit = 5 } = opts;
  // 1) 자기병원 제외
  let pool = raw.filter((p) => !isOwnBrand(p.name, brand));
  // 2) 명백한 이종 제외(전부 이종이면 원본 유지 — 최소 표본 보존)
  const clinical = pool.filter((p) => !isOffTopic(p, specialty));
  if (clinical.length > 0) pool = clinical;
  // 3) 진료과 관련 상호를 앞으로(제외가 아니라 정렬)
  let filtered = false;
  if (specialty) {
    const term = specialty.replace(/\s+/g, "");
    const key = (p: LocalPlace) => `${p.category}${p.name}`.replace(/\s+/g, "").includes(term);
    const match = pool.filter(key);
    const rest = pool.filter((p) => !key(p));
    filtered = match.length > 0 && rest.length > 0;
    pool = [...match, ...rest];
  }
  return { places: pool.slice(0, limit), filtered };
}
