// GEO Studio · 데이터 프로바이더 포트(계약) — Charter §4.
// 로직(M1~M5)은 이 인터페이스에만 의존한다. 목·네이버·AI 프로바이더를 갈아끼워도 로직 무변경.
// 모든 메서드는 async(네이버 실측은 네트워크). 목은 즉시 resolve.

/** 데이터 신뢰 티어 — 화면 배지로 노출(Charter §3). */
export type DataTier = "measured" | "ai" | "approx";

export type VolumePoint = { period: string; value: number };
export type SerpDoc = { rank: number; title: string; url: string; snippet: string; source: string };
export type Demographics = { byGender: Record<string, number>; byAge: Record<string, number> };
/** 절대 월간 검색수(검색광고 API). estimated=true면 데모 추정치. */
export type MonthlyVolume = { pc: number | null; mobile: number | null; total: number | null; competition: string | null; estimated: boolean };

export type ProviderField =
  | "searchVolume"
  | "monthlyVolume"
  | "relatedKeywords"
  | "serpTop"
  | "demographics"
  | "aiAnswers";

export interface SearchDataPort {
  /** 프로바이더 식별자(mock|naver|ai|hybrid). */
  readonly id: string;
  /** 필드별 데이터 티어(배지 표기용). */
  tierOf(field: ProviderField): DataTier;

  /** 🟢 검색량 추이(상대 트렌드 0~100). period: y(연)·m(월)·d(일). */
  searchVolume(keyword: string, period: "y" | "m" | "d"): Promise<VolumePoint[]>;
  /** 🟢 절대 월간 검색수(PC·모바일·합계). 검색광고 API 필요, 없으면 데모 추정. */
  monthlyVolume(keyword: string): Promise<MonthlyVolume | null>;
  /** 🟢 연관 키워드. */
  relatedKeywords(seed: string): Promise<string[]>;
  /** 🟢 SERP 상위 문서(순위·URL·스니펫). */
  serpTop(keyword: string, limit?: number): Promise<SerpDoc[]>;
  /** 🟡 검색자 성별·연령 분포(없으면 null). */
  demographics(keyword: string): Promise<Demographics | null>;
  /** 🔵 4-AI 답변 1건(플랫폼별). */
  aiAnswers(prompt: string, platform: string): Promise<string>;
}
