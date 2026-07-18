// GEO Studio · 프로바이더 포트 계약 테스트 — Charter §4.
import { describe, it, expect, beforeEach } from "vitest";
import { getProvider, resetProvider, currentSource } from "./resolver";
import { NaverProvider, NotConfiguredError } from "./naver";
import { HybridProvider } from "./hybrid";
import { MockProvider } from "./mock";

describe("SearchDataPort (mock)", () => {
  beforeEach(() => resetProvider());

  it("리졸버가 프로바이더를 반환(현재는 목 폴백)", () => {
    const p = getProvider();
    expect(p.id).toBe("mock");
    expect(["mock", "naver", "hybrid"]).toContain(currentSource());
  });

  it("검색량은 period별 길이가 결정적", async () => {
    const p = getProvider();
    expect((await p.searchVolume("맥주효모", "y")).length).toBe(5);
    expect((await p.searchVolume("맥주효모", "m")).length).toBe(12);
    expect((await p.searchVolume("맥주효모", "d")).length).toBe(30);
  });

  it("연관어·SERP·인구통계가 계약대로 반환", async () => {
    const p = getProvider();
    expect((await p.relatedKeywords("맥주효모")).length).toBeGreaterThan(0);
    const serp = await p.serpTop("맥주효모", 5);
    expect(serp.length).toBe(5);
    expect(serp[0]).toHaveProperty("rank", 1);
    expect(serp[0]).toHaveProperty("url");
    const demo = await p.demographics("맥주효모");
    expect(demo).not.toBeNull();
    expect(demo!.byAge).toHaveProperty("20대");
  });

  it("목 프로바이더의 티어는 전부 근사(실측 아님)", () => {
    const p = getProvider();
    expect(p.tierOf("searchVolume")).toBe("approx");
  });

  it("동일 입력 → 동일 출력(결정적)", async () => {
    const a = await getProvider().serpTop("런닝화", 3);
    resetProvider();
    const b = await getProvider().serpTop("런닝화", 3);
    expect(a).toEqual(b);
  });
});

describe("NaverProvider (키 미설정)", () => {
  const naver = new NaverProvider({});

  it("키 없으면 미설정·measured 필드도 근사", () => {
    expect(naver.isConfigured()).toBe(false);
    expect(naver.supports("searchVolume")).toBe(false);
    expect(naver.tierOf("searchVolume")).toBe("approx");
  });

  it("키 없으면 실측 메서드는 NotConfiguredError", async () => {
    await expect(naver.searchVolume("x", "m")).rejects.toThrow(NotConfiguredError);
    await expect(naver.serpTop("x")).rejects.toThrow(NotConfiguredError);
  });

  it("키 있으면 measured 필드 지원·티어 승격", () => {
    const cfg = new NaverProvider({ NAVER_CLIENT_ID: "id", NAVER_CLIENT_SECRET: "sec" });
    expect(cfg.isConfigured()).toBe(true);
    expect(cfg.supports("serpTop")).toBe(true);
    expect(cfg.tierOf("searchVolume")).toBe("measured");
    expect(cfg.tierOf("relatedKeywords")).toBe("approx"); // 검색 API로 미지원
  });
});

describe("HybridProvider (네이버 미지원 필드 → 목 폴백)", () => {
  const hybrid = new HybridProvider(new NaverProvider({}), new MockProvider());

  it("미설정 시 검색량은 목으로 폴백해 값 반환", async () => {
    expect(hybrid.tierOf("searchVolume")).toBe("approx"); // 키 없으니 목 티어
    expect((await hybrid.searchVolume("맥주효모", "m")).length).toBe(12);
  });

  it("네이버 미지원 필드(연관어)는 목으로", async () => {
    expect((await hybrid.relatedKeywords("맥주효모")).length).toBeGreaterThan(0);
  });
});
