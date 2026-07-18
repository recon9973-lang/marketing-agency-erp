// GEO Studio · 프로바이더 포트 계약 테스트 — Charter §4.
import { describe, it, expect, beforeEach } from "vitest";
import { getProvider, resetProvider, currentSource } from "./resolver";

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
