import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoVolume, fetchKeywordVolumes, naverSearchConfigured, toCount } from "@/server/integrations/naver-search";

describe("toCount", () => {
  it("parses numbers, comma strings, and '< 10'", () => {
    expect(toCount(1200)).toBe(1200);
    expect(toCount("1,200")).toBe(1200);
    expect(toCount("< 10")).toBe(10);
    expect(toCount("")).toBeNull();
    expect(toCount(null)).toBeNull();
  });
});

describe("demoVolume", () => {
  it("is deterministic and flagged as estimated", () => {
    const a = demoVolume("강남치과");
    const b = demoVolume("강남치과");
    expect(a).toEqual(b);
    expect(a.estimated).toBe(true);
    expect((a.pc ?? 0) + (a.mobile ?? 0)).toBe(a.total);
  });
});

describe("fetchKeywordVolumes (demo mode)", () => {
  beforeEach(() => {
    vi.stubEnv("NAVER_AD_API_KEY", "");
    vi.stubEnv("NAVER_AD_SECRET", "");
    vi.stubEnv("NAVER_AD_CUSTOMER_ID", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns estimated values and never calls the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(naverSearchConfigured()).toBe(false);

    const out = await fetchKeywordVolumes(["강남치과", "  ", "임플란트"]);

    expect(out).toHaveLength(2);
    expect(out.every((row) => row.estimated)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("caps at five keywords", async () => {
    const out = await fetchKeywordVolumes(["a", "b", "c", "d", "e", "f", "g"]);
    expect(out).toHaveLength(5);
  });
});

describe("fetchKeywordVolumes (configured)", () => {
  beforeEach(() => {
    vi.stubEnv("NAVER_AD_API_KEY", "key");
    vi.stubEnv("NAVER_AD_SECRET", "secret");
    vi.stubEnv("NAVER_AD_CUSTOMER_ID", "123");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("signs the request and parses the keywordList", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          keywordList: [
            { relKeyword: "강남치과", monthlyPcQcCnt: 1500, monthlyMobileQcCnt: "< 10", compIdx: "높음" }
          ]
        }),
        { status: 200 }
      )
    );

    const out = await fetchKeywordVolumes(["강남치과"]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["X-API-KEY"]).toBe("key");
    expect(headers["X-Customer"]).toBe("123");
    expect(headers["X-Signature"]).toBeTruthy();

    expect(out[0]).toMatchObject({
      keyword: "강남치과",
      pc: 1500,
      mobile: 10,
      total: 1510,
      competition: "높음",
      estimated: false
    });
  });

  it("returns nulls for keywords missing from the response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ keywordList: [] }), { status: 200 })
    );

    const out = await fetchKeywordVolumes(["없는키워드"]);
    expect(out[0]).toMatchObject({ keyword: "없는키워드", total: null, estimated: false });
  });

  it("throws on API error status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 401 }));
    await expect(fetchKeywordVolumes(["x"])).rejects.toThrow(/401/);
  });
});
