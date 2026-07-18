// GEO Studio · 네이버 실측 프로바이더 — Charter §3·§4 (P2).
// ⚠️ 중복 방지: 검색량(데이터랩)은 ERP 기존 연동 `integrations/naver-datalab`을 재사용한다.
//   - 검색량: fetchKeywordTrends(기존) 재사용                         → 🟢 실측
//   - SERP:   블로그 검색  GET /v1/search/blog.json (net-new, 동일 키) → 🟢 실측
// 키(NAVER_CLIENT_ID/SECRET)가 없으면 NotConfiguredError → 리졸버가 목으로 폴백.
import type { Demographics, ProviderField, SearchDataPort, SerpDoc, VolumePoint } from "./port";
import { fetchKeywordTrends } from "@/server/integrations/naver-datalab";

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

  async searchVolume(keyword: string, _period: "y" | "m" | "d"): Promise<VolumePoint[]> {
    if (!this.isConfigured()) throw new NotConfiguredError("searchVolume");
    // 기존 ERP 데이터랩 연동 재사용(최근 6개월 월간 트렌드). 중복 구현 없음.
    const trends = await fetchKeywordTrends([keyword]);
    const points = trends[0]?.points ?? [];
    if (points.length === 0) throw new NotConfiguredError("searchVolume");
    return points.map((p) => ({ period: p.period, value: p.ratio }));
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
