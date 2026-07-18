// GEO Studio · 프로바이더 리졸버 — Charter §4.
// GEO_DATA_SOURCE = mock | naver | hybrid(기본). 실측(naver) 미구성/실패 시 목 폴백.
// P2에서 NaverProvider·HybridProvider를 여기에 연결한다(현재는 목만 안정 제공).
import { MockProvider } from "./mock";
import { NaverProvider } from "./naver";
import { HybridProvider } from "./hybrid";
import type { SearchDataPort } from "./port";

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
  cached = naver.isConfigured() ? new HybridProvider(naver, mock) : mock;
  return cached;
}

/** 테스트/설정 변경용 리셋. */
export function resetProvider(): void {
  cached = null;
}
