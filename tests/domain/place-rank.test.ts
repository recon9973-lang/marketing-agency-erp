import { describe, expect, it } from "vitest";
import { placeRankFormSchema, rankDelta } from "@/domain/place-rank";

describe("placeRankFormSchema", () => {
  it("parses valid input and trims the keyword", () => {
    const parsed = placeRankFormSchema.parse({
      clientId: "client-1",
      keyword: "  강남 치과  ",
      rank: "5",
      recordedOn: "2026-07-03",
      memo: ""
    });

    expect(parsed.keyword).toBe("강남 치과");
    expect(parsed.rank).toBe(5);
    expect(parsed.memo).toBeUndefined();
  });

  it("rejects out-of-range ranks and malformed dates", () => {
    expect(
      placeRankFormSchema.safeParse({ clientId: "c", keyword: "k", rank: "0", recordedOn: "2026-07-03" }).success
    ).toBe(false);
    expect(
      placeRankFormSchema.safeParse({ clientId: "c", keyword: "k", rank: "1.5", recordedOn: "2026-07-03" }).success
    ).toBe(false);
    expect(
      placeRankFormSchema.safeParse({ clientId: "c", keyword: "k", rank: "3", recordedOn: "2026-7-3" }).success
    ).toBe(false);
  });
});

describe("rankDelta", () => {
  it("treats a lower rank number as an improvement", () => {
    expect(rankDelta(3, 7)).toBe(4);
    expect(rankDelta(7, 3)).toBe(-4);
    expect(rankDelta(5, 5)).toBe(0);
  });

  it("returns null when there is no previous record", () => {
    expect(rankDelta(3, null)).toBeNull();
    expect(rankDelta(3, undefined)).toBeNull();
  });
});
