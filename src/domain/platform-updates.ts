// 플랫폼 공지·업데이트 도메인 상수 — 서버/클라이언트 공용(순수, 부작용 없음).

export type PlatformKind = "GOOGLE" | "NAVER" | "ETC";
export type UpdateCategory = "BLOG" | "PLACE" | "CAFE" | "ALGORITHM" | "SEO" | "GEO" | "GENERAL";

export const PLATFORM_LABEL: Record<PlatformKind, string> = {
  GOOGLE: "구글",
  NAVER: "네이버",
  ETC: "기타"
};

export const CATEGORY_LABEL: Record<UpdateCategory, string> = {
  BLOG: "블로그",
  PLACE: "플레이스",
  CAFE: "카페",
  ALGORITHM: "알고리즘",
  SEO: "SEO",
  GEO: "GEO",
  GENERAL: "일반"
};

export function isPlatformKind(v: unknown): v is PlatformKind {
  return v === "GOOGLE" || v === "NAVER" || v === "ETC";
}

export function isUpdateCategory(v: unknown): v is UpdateCategory {
  return v === "BLOG" || v === "PLACE" || v === "CAFE" || v === "ALGORITHM" || v === "SEO" || v === "GEO" || v === "GENERAL";
}

// "NEW" 판정 기준일수 — 게시 후 이 기간 내면 새 공지로 간주.
export const NEW_WINDOW_DAYS = 7;

export function isNewUpdate(publishedAt: Date | string | number, now: number, windowDays = NEW_WINDOW_DAYS): boolean {
  const t = typeof publishedAt === "object" ? publishedAt.getTime() : new Date(publishedAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now - t <= windowDays * 86400000;
}

/**
 * 제목 기반 카테고리 추론 — 피드가 세분 카테고리를 주지 않으므로 키워드로 보정한다.
 * fallback은 소스에 설정된 기본 카테고리.
 */
export function inferCategory(title: string, fallback: UpdateCategory): UpdateCategory {
  const t = title.toLowerCase();
  // 네이버 세부 서비스
  if (/(스마트\s*플레이스|플레이스|place|지도|스마트플레이스)/i.test(title)) return "PLACE";
  if (/(카페|cafe)/i.test(title)) return "CAFE";
  if (/(블로그|blog|인플루언서|c-?rank|씨랭크|다이아|d\.?i\.?a)/i.test(title)) return "BLOG";
  // 알고리즘/랭킹/스팸(구글·네이버 공통)
  if (/(core update|algorithm|알고리즘|랭킹|ranking|spam|스팸|penalty|어뷰징|abuse)/i.test(t)) return "ALGORITHM";
  // 생성형/AI 검색(GEO)
  if (/(ai overview|sge|gemini|ai\s*검색|생성형|generative|ai mode|search generative)/i.test(t)) return "GEO";
  if (/(seo|search|검색엔진|색인|indexing|크롤)/i.test(t)) return "SEO";
  return fallback;
}
