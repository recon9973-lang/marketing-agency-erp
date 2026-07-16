// src/components/geo/SovChart.test.ts
import { describe, it, expect } from "vitest";
import { buildSovView } from "./SovChart";
import type { SovResult } from "@/server/geo-engine/sov";

const sov = (o: Partial<SovResult>): SovResult => ({
  selfMentions: 0,
  competitorMentions: {},
  totalCompetitor: 0,
  sovPct: null,
  ...o
});

describe("buildSovView(SovResult → 뷰모델)", () => {
  it("경쟁사를 언급 수 내림차순으로 정렬하고 최대치 대비 막대 %를 산출한다", () => {
    const v = buildSovView(sov({ selfMentions: 6, competitorMentions: { A: 2, B: 4 }, totalCompetitor: 6, sovPct: 50 }));
    expect(v.hasData).toBe(true);
    expect(v.competitors.map((c) => c.name)).toEqual(["B", "A"]); // 4 > 2
    expect(v.selfBarPct).toBe(100); // max=6 → 자사 6/6
    expect(v.competitors.find((c) => c.name === "B")!.barPct).toBe(67); // 4/6
    expect(v.competitors.find((c) => c.name === "A")!.barPct).toBe(33); // 2/6
  });

  it("관측이 전혀 없으면(sovPct null) hasData=false·빈 경쟁사", () => {
    const v = buildSovView(sov({}));
    expect(v.hasData).toBe(false);
    expect(v.competitors).toEqual([]);
    expect(v.sovPct).toBeNull();
  });

  it("자사만 출현(경쟁사 0)이면 hasData=true·경쟁사 목록 비어있음", () => {
    const v = buildSovView(sov({ selfMentions: 5, totalCompetitor: 0, sovPct: 100 }));
    expect(v.hasData).toBe(true);
    expect(v.competitors).toEqual([]);
    expect(v.selfBarPct).toBe(100);
  });

  it("언급 수 동률이면 이름 오름차순으로 안정 정렬한다", () => {
    const v = buildSovView(sov({ selfMentions: 1, competitorMentions: { B: 2, A: 2 }, totalCompetitor: 4, sovPct: 20 }));
    expect(v.competitors.map((c) => c.name)).toEqual(["A", "B"]);
  });

  it("언급 0인 경쟁사는 분해에서 제외한다", () => {
    const v = buildSovView(sov({ selfMentions: 3, competitorMentions: { A: 0, B: 3 }, totalCompetitor: 3, sovPct: 50 }));
    expect(v.competitors.map((c) => c.name)).toEqual(["B"]);
  });
});
