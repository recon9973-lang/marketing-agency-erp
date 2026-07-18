// GEO Studio · 하이브리드 프로바이더 — Charter §3. 네이버 실측 우선, 실패/미지원 시 목 폴백.
// 필드별로 최적 소스를 고른다: 검색량·SERP=네이버(🟢), 나머지=목(🟡근사).
import type { Demographics, ProviderField, SearchDataPort, SerpDoc, VolumePoint } from "./port";
import type { NaverProvider } from "./naver";
import type { MockProvider } from "./mock";

export class HybridProvider implements SearchDataPort {
  readonly id = "hybrid";
  constructor(private readonly naver: NaverProvider, private readonly mock: MockProvider) {}

  tierOf(field: ProviderField): "measured" | "ai" | "approx" {
    return this.naver.supports(field) ? "measured" : this.mock.tierOf(field);
  }

  private async pick<T>(field: ProviderField, live: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (!this.naver.supports(field)) return fallback();
    try {
      return await live();
    } catch {
      return fallback(); // 실측 실패 시 조용히 목 폴백(화면은 배지로 근사 표기).
    }
  }

  searchVolume(keyword: string, period: "y" | "m" | "d"): Promise<VolumePoint[]> {
    return this.pick("searchVolume", () => this.naver.searchVolume(keyword, period), () => this.mock.searchVolume(keyword, period));
  }
  relatedKeywords(seed: string): Promise<string[]> {
    return this.pick("relatedKeywords", () => this.naver.relatedKeywords(seed), () => this.mock.relatedKeywords(seed));
  }
  serpTop(keyword: string, limit?: number): Promise<SerpDoc[]> {
    return this.pick("serpTop", () => this.naver.serpTop(keyword, limit), () => this.mock.serpTop(keyword, limit));
  }
  demographics(keyword: string): Promise<Demographics | null> {
    return this.pick("demographics", () => this.naver.demographics(keyword), () => this.mock.demographics(keyword));
  }
  aiAnswers(prompt: string, platform: string): Promise<string> {
    return this.pick("aiAnswers", () => this.naver.aiAnswers(prompt, platform), () => this.mock.aiAnswers(prompt, platform));
  }
}
