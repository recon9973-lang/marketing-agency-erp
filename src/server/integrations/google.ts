// 목표 경로: src/server/integrations/google.ts
//
// 구글 OAuth + GSC(Search Console)·GA4(Analytics Data) REST 클라이언트.
// 외부 SDK 없이 fetch만 사용. refresh token은 crypto.ts(AES-256-GCM)로 암호화 저장.
//
// 필요 환경변수:
//  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — GCP OAuth 클라이언트(웹)
//  GOOGLE_REDIRECT_URI — 예: https://<도메인>/api/integrations/google/callback
// 콘솔에서 Search Console API + Google Analytics Data API 활성화 필요.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// GSC 읽기 + GA4 읽기 — 리포트 수집에 필요한 최소 범위(§8 자동화 원칙: 읽기 전용)
const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly"
].join(" ");

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

/** 동의 화면 URL — state에 암호화된 컨텍스트(clientId 등)를 실어 콜백에서 복원. */
export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
    response_type: "code",
    scope: SCOPES,
    access_type: "offline", // refresh token 발급
    prompt: "consent", // 재연결 시에도 refresh token 재발급
    state
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type GoogleTokens = { accessToken: string; refreshToken?: string; expiresIn: number };

/** 인가 코드 → 토큰 교환(콜백에서 1회). */
export async function exchangeGoogleCode(code: string): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? "",
      grant_type: "authorization_code"
    })
  });
  if (!res.ok) throw new Error(`GOOGLE_TOKEN_EXCHANGE_FAILED:${res.status}`);
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

/** refresh token → access token 갱신(동기화 잡에서 매회). */
export async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token"
    })
  });
  if (!res.ok) throw new Error(`GOOGLE_TOKEN_REFRESH_FAILED:${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export type DailyPoint = { date: string; value: number }; // date: YYYY-MM-DD

/** GSC Search Analytics — 일자별 노출/클릭(검색 성과, §13 리포트 소스 1). */
export async function fetchGscDaily(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<{ impressions: DailyPoint[]; clicks: DailyPoint[] }> {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions: ["date"], rowLimit: 1000 })
    }
  );
  if (!res.ok) throw new Error(`GSC_QUERY_FAILED:${res.status}`);
  const data = (await res.json()) as { rows?: Array<{ keys: string[]; impressions: number; clicks: number }> };
  const impressions: DailyPoint[] = [];
  const clicks: DailyPoint[] = [];
  for (const row of data.rows ?? []) {
    const date = row.keys[0];
    impressions.push({ date, value: Math.round(row.impressions) });
    clicks.push({ date, value: Math.round(row.clicks) });
  }
  return { impressions, clicks };
}

/** GA4 Data API — 일자별 세션(방문, §13 리포트 소스 2). */
export async function fetchGa4Daily(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<DailyPoint[]> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }],
        limit: 1000
      })
    }
  );
  if (!res.ok) throw new Error(`GA4_QUERY_FAILED:${res.status}`);
  const data = (await res.json()) as {
    rows?: Array<{ dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }>;
  };
  return (data.rows ?? []).map((row) => {
    const raw = row.dimensionValues[0]?.value ?? ""; // YYYYMMDD
    const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    return { date, value: Math.round(Number(row.metricValues[0]?.value ?? 0)) };
  });
}
