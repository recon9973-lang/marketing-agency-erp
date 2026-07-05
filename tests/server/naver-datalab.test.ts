import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchKeywordTrends, naverDatalabConfigured, trendDateRange } from "@/server/integrations/naver-datalab";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("naverDatalabConfigured", () => {
  it("requires both client id and secret", () => {
    vi.stubEnv("NAVER_CLIENT_ID", "cid");
    vi.stubEnv("NAVER_CLIENT_SECRET", "");
    expect(naverDatalabConfigured()).toBe(false);
    vi.stubEnv("NAVER_CLIENT_SECRET", "sec");
    expect(naverDatalabConfigured()).toBe(true);
  });
});

describe("trendDateRange", () => {
  it("spans the last ~6 months up to the given date", () => {
    const { startDate, endDate } = trendDateRange(new Date("2026-07-05T00:00:00Z"));
    expect(startDate).toBe("2026-02-01");
    expect(endDate).toBe("2026-07-05");
  });
});

describe("fetchKeywordTrends", () => {
  it("returns [] when unconfigured (no network)", async () => {
    vi.stubEnv("NAVER_CLIENT_ID", "");
    vi.stubEnv("NAVER_CLIENT_SECRET", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await fetchKeywordTrends(["강남치과"])).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("signs headers and summarizes trend (latest, delta, peak)", async () => {
    vi.stubEnv("NAVER_CLIENT_ID", "cid");
    vi.stubEnv("NAVER_CLIENT_SECRET", "sec");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              title: "강남치과",
              data: [
                { period: "2026-02-01", ratio: 40 },
                { period: "2026-03-01", ratio: 90 },
                { period: "2026-04-01", ratio: 60 }
              ]
            }
          ]
        }),
        { status: 200 }
      )
    );

    const out = await fetchKeywordTrends(["강남치과"], new Date("2026-07-05T00:00:00Z"));

    expect(out[0]).toMatchObject({ keyword: "강남치과", latestRatio: 60, delta: 20, peakRatio: 90 });
    expect(out[0].points).toHaveLength(3);
    const headers = (fetchSpy.mock.calls[0][1]?.headers ?? {}) as Record<string, string>;
    expect(headers["X-Naver-Client-Id"]).toBe("cid");
    expect(headers["X-Naver-Client-Secret"]).toBe("sec");
  });

  it("returns empty points for a keyword missing from the response", async () => {
    vi.stubEnv("NAVER_CLIENT_ID", "cid");
    vi.stubEnv("NAVER_CLIENT_SECRET", "sec");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));

    const out = await fetchKeywordTrends(["없는키워드"]);
    expect(out[0]).toMatchObject({ keyword: "없는키워드", latestRatio: null, points: [] });
  });

  it("throws on API error", async () => {
    vi.stubEnv("NAVER_CLIENT_ID", "cid");
    vi.stubEnv("NAVER_CLIENT_SECRET", "sec");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 401 }));
    await expect(fetchKeywordTrends(["x"])).rejects.toThrow(/401/);
  });
});
