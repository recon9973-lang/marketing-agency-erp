import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGbpDaily } from "@/server/integrations/google";

function mockFetchOnce(payload: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, status, json: async () => payload }) as unknown as Response),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchGbpDaily — GBP 성과 집계", () => {
  it("검색+지도 노출은 impressions로, 통화/웹클릭은 interactions로 일자별 합산한다", async () => {
    const d = (day: number) => ({ year: 2026, month: 7, day });
    mockFetchOnce({
      multiDailyMetricTimeSeries: [
        {
          dailyMetricTimeSeries: [
            { dailyMetric: "BUSINESS_IMPRESSIONS_MOBILE_SEARCH", timeSeries: { datedValues: [{ date: d(1), value: "10" }] } },
            { dailyMetric: "BUSINESS_IMPRESSIONS_DESKTOP_MAPS", timeSeries: { datedValues: [{ date: d(1), value: "5" }] } },
            { dailyMetric: "CALL_CLICKS", timeSeries: { datedValues: [{ date: d(1), value: "3" }] } },
            { dailyMetric: "WEBSITE_CLICKS", timeSeries: { datedValues: [{ date: d(1), value: "2" }] } },
          ],
        },
      ],
    });

    const r = await fetchGbpDaily("tok", "locations/123", "2026-07-01", "2026-07-02");
    expect(r.impressions).toEqual([{ date: "2026-07-01", value: 15 }]); // 10 + 5
    expect(r.interactions).toEqual([{ date: "2026-07-01", value: 5 }]); // 3 + 2
  });

  it("실패 응답은 GBP_QUERY_FAILED로 던진다", async () => {
    mockFetchOnce({}, false, 403);
    await expect(fetchGbpDaily("tok", "123", "2026-07-01", "2026-07-02")).rejects.toThrow("GBP_QUERY_FAILED:403");
  });
});
