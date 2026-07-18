// GEO Studio · 네이버 실측 프로바이더 — Charter §3·§4 (P2).
// 배포 ERP가 네이버 공식 오픈API를 직접 호출한다(이 세션의 MCP 아님).
//   - 검색량: 데이터랩 검색어 트렌드  POST /v1/datalab/search        → 🟢 실측
//   - SERP:   블로그 검색            GET  /v1/search/blog.json        → 🟢 실측
// 키(NAVER_CLIENT_ID/SECRET)가 없으면 NotConfiguredError → 리졸버가 목으로 폴백.
// 응답 형태는 실제 호출로 확인한 스키마에 맞춤(ratio 시계열 / items[].title·link·description).
import type { Demographics, ProviderField, SearchDataPort, SerpDoc, VolumePoint } from "./port";

const DATALAB_URL = "https://openapi.naver.com/v1/datalab/search";
const BLOG_URL = "https://openapi.naver.com/v1/search/blog.json";

export class NotConfiguredError extends Error {
  constructor(field: string) {
    super(`NaverProvider: ${field} 미지원 또는 키 미설정`);
    this.name = "NotConfiguredError";
  }
}

/** <b> 하이라이트·기본 엔티티 제거. */
function clean(s: string): string {
  return s
    .replace(/<\/?b>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** period → 데이터랩 startDate·timeUnit(현재 시점 기준). */
function rangeFor(period: "y" | "m" | "d", now: Date): { startDate: string; endDate: string; timeUnit: "date" | "week" | "month" } {
  const end = new Date(now);
  const start = new Date(now);
  if (period === "y") {
    start.setFullYear(start.getFullYear() - 5);
    return { startDate: fmt(start), endDate: fmt(end), timeUnit: "month" };
  }
  if (period === "m") {
    start.setMonth(start.getMonth() - 12);
    return { startDate: fmt(start), endDate: fmt(end), timeUnit: "month" };
  }
  start.setDate(start.getDate() - 30);
  return { startDate: fmt(start), endDate: fmt(end), timeUnit: "date" };
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MEASURED: ReadonlySet<ProviderField> = new Set<ProviderField>(["searchVolume", "serpTop"]);

export class NaverProvider implements SearchDataPort {
  readonly id = "naver";
  private readonly clientId?: string;
  private readonly clientSecret?: string;

  constructor(env: Record<string, string | undefined> = process.env) {
    this.clientId = env.NAVER_CLIENT_ID;
    this.clientSecret = env.NAVER_CLIENT_SECRET;
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /** 이 프로바이더가 실측으로 지원하는 필드인지(키 있고 measured). */
  supports(field: ProviderField): boolean {
    return this.isConfigured() && MEASURED.has(field);
  }

  tierOf(field: ProviderField): "measured" | "ai" | "approx" {
    return this.supports(field) ? "measured" : "approx";
  }

  private headers(): Record<string, string> {
    return {
      "X-Naver-Client-Id": this.clientId!,
      "X-Naver-Client-Secret": this.clientSecret!,
      "Content-Type": "application/json"
    };
  }

  async searchVolume(keyword: string, period: "y" | "m" | "d"): Promise<VolumePoint[]> {
    if (!this.isConfigured()) throw new NotConfiguredError("searchVolume");
    const { startDate, endDate, timeUnit } = rangeFor(period, new Date());
    const res = await fetch(DATALAB_URL, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ startDate, endDate, timeUnit, keywordGroups: [{ groupName: keyword, keywords: [keyword] }] })
    });
    if (!res.ok) throw new Error(`데이터랩 ${res.status}`);
    const data = (await res.json()) as { results?: { data?: { period: string; ratio: number }[] }[] };
    const series = data.results?.[0]?.data ?? [];
    return series.map((d) => ({ period: d.period, value: d.ratio }));
  }

  async serpTop(keyword: string, limit = 10): Promise<SerpDoc[]> {
    if (!this.isConfigured()) throw new NotConfiguredError("serpTop");
    const url = `${BLOG_URL}?query=${encodeURIComponent(keyword)}&display=${Math.min(limit, 20)}&sort=sim`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`블로그검색 ${res.status}`);
    const data = (await res.json()) as { items?: { title: string; link: string; description: string }[] };
    return (data.items ?? []).slice(0, limit).map((it, i) => ({
      rank: i + 1,
      title: clean(it.title),
      url: it.link,
      snippet: clean(it.description),
      source: "blog"
    }));
  }

  // 네이버 검색 API로 직접 얻기 어려운 필드 — 하이브리드에서 목/AI로 폴백.
  async relatedKeywords(_seed: string): Promise<string[]> {
    throw new NotConfiguredError("relatedKeywords");
  }
  async demographics(_keyword: string): Promise<Demographics | null> {
    throw new NotConfiguredError("demographics");
  }
  async aiAnswers(_prompt: string, _platform: string): Promise<string> {
    throw new NotConfiguredError("aiAnswers");
  }
}
