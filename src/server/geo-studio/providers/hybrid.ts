// GEO Studio · 하이브리드 프로바이더 — Charter §3. 네이버 실측 우선, 실패/미지원 시 목 폴백.
// 필드별로 최적 소스를 고른다: 검색량·SERP=네이버(🟢), 나머지=목(🟡근사).
import type { DataTier, Demographics, MonthlyVolume, ProviderField, SearchDataPort, SerpDoc, VolumePoint } from "./port";
import type { NaverProvider } from "./naver";
import type { MockProvider } from "./mock";

/** 실제로 사용된 티어를 호출부에 통지하는 요청 스코프 콜백(폴백 시 배지 강등용). */
export type EffectiveTierSink = (field: ProviderField, tier: DataTier) => void;

export class HybridProvider implements SearchDataPort {
  readonly id = "hybrid";
  // onEffectiveTier: 요청마다 새 인스턴스에 주입 — 싱글턴 공유상태 없이 폴백 여부를 기록.
  constructor(
    private readonly naver: NaverProvider,
    private readonly mock: MockProvider,
    private readonly onEffectiveTier?: EffectiveTierSink
  ) {}

  tierOf(field: ProviderField): "measured" | "ai" | "approx" {
    return this.naver.supports(field) ? "measured" : this.mock.tierOf(field);
  }

  private async pick<T>(field: ProviderField, live: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (!this.naver.supports(field)) {
      this.onEffectiveTier?.(field, this.mock.tierOf(field));
      return fallback();
    }
    try {
      const out = await live();
      this.onEffectiveTier?.(field, "measured");
      return out;
    } catch (err) {
      // 실측 실패(쿼터·오류) → 목 폴백. 관측 가능하도록 경고 로그(무음 금지) + 티어 강등 통지.
      console.warn(`[geo-studio] 실측 실패로 목 폴백: ${field} —`, err instanceof Error ? err.message : err);
      this.onEffectiveTier?.(field, this.mock.tierOf(field));
      return fallback();
    }
  }

  searchVolume(keyword: string, period: "y" | "m" | "d"): Promise<VolumePoint[]> {
    return this.pick("searchVolume", () => this.naver.searchVolume(keyword, period), () => this.mock.searchVolume(keyword, period));
  }
  monthlyVolume(keyword: string): Promise<MonthlyVolume | null> {
    return this.pick("monthlyVolume", () => this.naver.monthlyVolume(keyword), () => this.mock.monthlyVolume(keyword));
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
