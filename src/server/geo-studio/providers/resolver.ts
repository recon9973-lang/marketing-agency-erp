// GEO Studio · 프로바이더 리졸버 — Charter §4.
// GEO_DATA_SOURCE = mock | naver | hybrid(기본). 실측(naver) 미구성/실패 시 목 폴백.
// P2에서 NaverProvider·HybridProvider를 여기에 연결한다(현재는 목만 안정 제공).
import { MockProvider } from "./mock";
import { NaverProvider } from "./naver";
import { HybridProvider } from "./hybrid";
import type { DataTier, ProviderField, SearchDataPort } from "./port";

export type DataSource = "mock" | "naver" | "hybrid";

export function currentSource(): DataSource {
  const v = (process.env.GEO_DATA_SOURCE ?? "hybrid").toLowerCase();
  return v === "mock" || v === "naver" ? v : "hybrid";
}

let cached: SearchDataPort | null = null;

/** 현재 설정에 맞는 데이터 프로바이더.
 *  - GEO_DATA_SOURCE=mock  → 항상 목
 *  - naver|hybrid + 네이버 키 있음 → 하이브리드(실측 우선, 목 폴백)
 *  - 키 없음 → 목(자동 폴백)
 */
export function getProvider(): SearchDataPort {
  if (cached) return cached;
  const mock = new MockProvider();
  if (currentSource() === "mock") {
    cached = mock;
    return cached;
  }
  const naver = new NaverProvider();
  // 오픈API(데이터랩·검색) 또는 검색광고 중 하나라도 있으면 하이브리드.
  cached = naver.isConfiguredAny() ? new HybridProvider(naver, mock) : mock;
  return cached;
}

/** 테스트/설정 변경용 리셋. */
export function resetProvider(): void {
  cached = null;
}

/** 요청 스코프 프로바이더 — 배지에 '실제 사용된' 티어를 반영.
 *  hybrid는 신규 인스턴스에 티어 기록기를 주입해(싱글턴 공유상태 없음) 폴백 시 배지를 강등한다.
 *  effectiveTier(field): 데이터 호출 후 실제 티어(기록 없으면 정적 tierOf). */
export function getRequestProvider(): { provider: SearchDataPort; effectiveTier: (field: ProviderField) => DataTier } {
  const recorded = new Map<ProviderField, DataTier>();
  const mock = new MockProvider();
  let provider: SearchDataPort;
  if (currentSource() === "mock") {
    provider = mock;
  } else {
    const naver = new NaverProvider();
    provider = naver.isConfiguredAny()
      ? new HybridProvider(naver, mock, (field, tier) => recorded.set(field, tier))
      : mock;
  }
  return {
    provider,
    effectiveTier: (field) => recorded.get(field) ?? provider.tierOf(field)
  };
}
