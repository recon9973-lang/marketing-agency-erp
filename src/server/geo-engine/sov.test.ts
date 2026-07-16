// src/server/geo-engine/sov.test.ts
import { describe, it, expect } from "vitest";
import { buildSov, asCompetitors } from "./sov";

describe("GEO SOV — 경쟁사 대비 점유율", () => {
  it("self /(self + comp) 로 SOV% 를 산출한다", () => {
    const r = buildSov([
      { appeared: true, competitors: [] },
      { appeared: false, competitors: ["A정형외과"] },
      { appeared: true, competitors: ["A정형외과", "B통증"] },
      { appeared: false, competitors: [] }
    ]);
    expect(r.selfMentions).toBe(2);
    expect(r.totalCompetitor).toBe(3);
    expect(r.competitorMentions).toEqual({ A정형외과: 2, B통증: 1 });
    expect(r.sovPct).toBe(40); // 2/(2+3)=40%
  });

  it("자사 우위면 50% 초과", () => {
    const r = buildSov([
      { appeared: true, competitors: [] },
      { appeared: true, competitors: ["A"] },
      { appeared: true, competitors: [] }
    ]);
    expect(r.sovPct).toBe(75); // 3/(3+1)
  });

  it("아무 언급이 없으면 null(측정불가)", () => {
    expect(buildSov([{ appeared: false, competitors: [] }]).sovPct).toBeNull();
    expect(buildSov([]).sovPct).toBeNull();
  });

  it("asCompetitors: Prisma Json 을 안전하게 string[] 로 변환", () => {
    expect(asCompetitors(["A", "", "B", 3, null])).toEqual(["A", "B"]);
    expect(asCompetitors(null)).toEqual([]);
    expect(asCompetitors("x")).toEqual([]);
    expect(asCompetitors(undefined)).toEqual([]);
  });
});
