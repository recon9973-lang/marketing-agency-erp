import "server-only";
/**
 * 지역 키워드 실측 스캔 — 제안 덱 "07. 키워드 분석" 표를 실측으로 자동 생성.
 *
 * 지역명 + 진료과/대표시술로 시드 키워드를 만들고,
 *   · 월간 검색수(PC/Mobile/합계)·경쟁도  ← 네이버 검색광고 키워드도구(NAVER_AD)
 *   · 블로그 발행 문서 수 → 포화도          ← 네이버 블로그 검색(NAVER_CLIENT)
 * 를 붙여 "검색수요 vs 콘텐츠 포화" 구조를 한 표로 보여준다. 미연결 시 안전 강등.
 */
import { fetchKeywordExpansion, type KeywordFull } from "@/server/integrations/naver-search";
import { fetchBlogDocCount, naverLocalConfigured } from "@/server/integrations/naver-local";

// 진료과 → 지역 결합 대표 검색어(시드). 덱 사례(달서구다이어트·비만클리닉·마운자로…) 일반화.
const SPECIALTY_TERMS: Record<string, string[]> = {
  가정의학과: ["가정의학과", "다이어트", "비만클리닉", "마운자로", "위고비", "영양수액"],
  내과: ["내과", "건강검진", "위내시경", "당뇨"],
  정형외과: ["정형외과", "도수치료", "체외충격파", "무릎통증", "허리디스크"],
  재활의학과: ["재활의학과", "도수치료", "통증"],
  신경외과: ["신경외과", "허리디스크", "목디스크"],
  피부과: ["피부과", "여드름", "보톡스", "필러", "리프팅"],
  성형외과: ["성형외과", "눈성형", "코성형", "리프팅"],
  한의원: ["한의원", "다이어트한약", "추나요법", "교통사고한의원"],
  한방병원: ["한방병원", "추나", "교통사고", "다이어트한약"],
  치과: ["치과", "임플란트", "치아교정", "충치치료"],
  안과: ["안과", "라식", "라섹", "백내장"],
  이비인후과: ["이비인후과", "비염", "코막힘", "중이염"],
  산부인과: ["산부인과", "산후조리", "여성검진"],
  소아청소년과: ["소아과", "소아청소년과", "예방접종"],
  비뇨의학과: ["비뇨기과", "비뇨의학과", "전립선"],
  요양병원: ["요양병원", "재활", "장기요양"]
};

/** resolve.label("대구 수성구") → 지역 토큰들(["대구","수성구"], 공백 제거). 광역+시군구. */
function regionTokens(label: string): string[] {
  return label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/\s+/g, ""))
    .filter((t) => t.length >= 2);
}

/**
 * 지역 + 진료과 → 시드 키워드(최대 5, 검색광고 도구 상한).
 * 시군구(수성구) 접두를 기본으로, 광역(대구)이 따로 있으면 대표어 1개는 광역 접두도 포함
 * → "대구 지역 키워드"가 빠지지 않게 한다.
 */
export function buildSeedKeywords(regionLabel: string, specialty: string | null): string[] {
  const toks = regionTokens(regionLabel);
  const district = toks[toks.length - 1] || regionLabel.trim().replace(/\s+/g, "");
  const metro = toks.length > 1 ? toks[0] : "";
  const terms = (specialty && SPECIALTY_TERMS[specialty]) || ["병원", "의원"];
  const seeds: string[] = [];
  if (terms[0]) seeds.push(`${district}${terms[0]}`); // [0] 시군구+대표(수성구한방병원)
  if (metro && terms[0]) seeds.push(`${metro}${terms[0]}`); // [1] 광역+대표(대구한방병원) — 대구 누락 방지
  for (const t of terms.slice(1)) seeds.push(`${district}${t}`); // 시군구+나머지
  return [...new Set(seeds)].slice(0, 5);
}

export type Saturation = "여유" | "보통" | "과열";
export type KeywordScanRow = {
  keyword: string;
  pc: number | null;
  mobile: number | null;
  total: number | null;
  competition: string | null; // 낮음/중간/높음
  adDepth: number | null; // 파워링크 평균 노출 광고수
  blogDocs: number | null; // 블로그 발행 문서 수
  saturation: Saturation | null;
  seed: boolean;
};

export type KeywordScan = {
  rows: KeywordScanRow[];
  searchConnected: boolean; // NAVER_AD 검색량 실측 여부
  blogConnected: boolean; // 네이버 블로그 포화도 실측 여부
};

/** 검색수요 대비 블로그 발행량으로 포화도 판정(근사). */
function saturationOf(total: number | null, blogDocs: number | null): Saturation | null {
  if (blogDocs == null) return null;
  const ratio = blogDocs / Math.max(total ?? 0, 1);
  if (blogDocs >= 300 || ratio >= 3) return "과열";
  if (blogDocs < 50 && ratio < 1) return "여유";
  return "보통";
}

/** 지역+진료과 키워드 실측 스캔(검색량·경쟁도·포화도). 최대 rows 개까지. */
export async function scanKeywords(regionLabel: string, specialty: string | null, max = 10): Promise<KeywordScan> {
  const seeds = buildSeedKeywords(regionLabel, specialty);
  const exp = await fetchKeywordExpansion(seeds).catch(() => ({ rows: [] as KeywordFull[], connected: false, truncated: 0 }));
  const seedSet = new Set(seeds.map((s) => s.replace(/\s+/g, "")));
  // 지역 한정: 연관키워드에서 지역 토큰(대구/수성구 등)이 없는 전국 대표어(이비인후과·도수치료 등)는 제외.
  // 지역 상권 분석엔 전국 볼륨이 노이즈이므로 시드 또는 지역명 포함 키워드만 남긴다.
  const tokens = regionTokens(regionLabel);
  const isLocal = (kw: string) => {
    const k = kw.replace(/\s+/g, "");
    return seedSet.has(k) || tokens.some((t) => k.includes(t));
  };
  const localRows = tokens.length > 0 ? exp.rows.filter((r) => isLocal(r.keyword)) : exp.rows;
  // 시드 우선 + 검색량 상위 연관 → 상위 max개.
  const sorted = [...localRows].sort((a, b) => {
    const sa = seedSet.has(a.keyword.replace(/\s+/g, "")) ? 1 : 0;
    const sb = seedSet.has(b.keyword.replace(/\s+/g, "")) ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return (b.total ?? 0) - (a.total ?? 0);
  });
  const picked = sorted.slice(0, max);

  const blogConnected = naverLocalConfigured();
  const blogCounts = await Promise.all(
    picked.map((r) => (blogConnected ? fetchBlogDocCount(r.keyword).catch(() => null) : Promise.resolve(null)))
  );

  const rows: KeywordScanRow[] = picked.map((r, i) => ({
    keyword: r.keyword,
    pc: r.pc,
    mobile: r.mobile,
    total: r.total,
    competition: r.competition,
    adDepth: r.adDepth,
    blogDocs: blogCounts[i],
    saturation: saturationOf(r.total, blogCounts[i]),
    seed: seedSet.has(r.keyword.replace(/\s+/g, ""))
  }));

  return { rows, searchConnected: exp.connected, blogConnected };
}
