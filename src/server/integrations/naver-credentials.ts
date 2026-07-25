import "server-only";
/**
 * 네이버 검색 OpenAPI(지역검색·블로그·데이터랩) 자격증명 해석 — 단일 소스.
 *
 * 환경변수 이름이 배포마다 `NAVER_CLIENT_*` 또는 `NAVER_SEARCH_CLIENT_*` 로 갈리는
 * 경우가 있어(둘 다 같은 검색 OpenAPI 앱의 ID/Secret), 어느 쪽이든 읽어 통일한다.
 * → 이름 불일치로 미연동되는 사고를 원천 차단.
 *
 * 검색광고(NAVER_AD_*)는 별개 서비스이므로 여기서 다루지 않는다.
 */
export function naverOpenApiCreds(): { id: string; secret: string } | null {
  const id = process.env.NAVER_CLIENT_ID || process.env.NAVER_SEARCH_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET || process.env.NAVER_SEARCH_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
}

/** 네이버 검색 OpenAPI 연결 여부(어느 이름이든 한 쌍이 있으면 true). */
export function naverOpenApiConfigured(): boolean {
  return naverOpenApiCreds() != null;
}
