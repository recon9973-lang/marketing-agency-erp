import { describe, expect, it } from "vitest";
import { buildBrandTrendIndex } from "./brand-index";
import type { Demographics, MonthlyVolume, ProviderField, SearchDataPort, SerpDoc, VolumePoint } from "@/server/geo-studio/providers/port";

// 결정적 스텁 — 키워드별 고정 시계열을 반환. 특정 키워드는 예외/빈배열로 경계 확인.
function stub(map: Record<string, VolumePoint[]>, throwOn: string[] = []): SearchDataPort {
  return {
    id: "stub",
    tierOf: () => "measured" as const,
    async searchVolume(keyword: string): Promise<VolumePoint[]> {
      if (throwOn.includes(keyword)) throw new Error("boom");
      return map[keyword] ?? [];
    },
    async monthlyVolume(): Promise<MonthlyVolume | null> {
      return null;
    },
    async relatedKeywords(): Promise<string[]> {
      return [];
    },
    async serpTop(): Promise<SerpDoc[]> {
      return [];
    },
    async demographics(): Promise<Demographics | null> {
      return null;
    },
    async aiAnswers(): Promise<string> {
      return "";
    }
  } satisfies SearchDataPort & { tierOf: (f: ProviderField) => "measured" };
}

const pts = (vals: number[]): VolumePoint[] => vals.map((v, i) => ({ period: `2026-0${i + 1}-01`, value: v }));

describe("buildBrandTrendIndex — 시계열/과거비교(P3)", () => {
  it("브랜드·카테고리·경쟁사를 역할별로 수집", async () => {
    const provider = stub({ 햇살숙소: pts([10, 20, 30]), "제주 숙소": pts([50, 60, 55]), 블루하우스: pts([40, 30, 20]) });
    const out = await buildBrandTrendIndex(provider, { brand: "햇살숙소", category: "제주 숙소", competitors: ["블루하우스"] });
    expect(out.hasData).toBe(true);
    expect(out.series.map((s) => s.role)).toEqual(["brand", "category", "competitor"]);
    expect(out.brand?.keyword).toBe("햇살숙소");
  });

  it("과거비교 계산: 전월비·구간변화·최고점 대비", async () => {
    const provider = stub({ B: pts([20, 50, 40]), C: pts([10, 10, 10]) });
    const out = await buildBrandTrendIndex(provider, { brand: "B", category: "C" });
    const b = out.brand!;
    expect(b.latest).toBe(40);
    expect(b.first).toBe(20);
    expect(b.peak).toBe(50);
    expect(b.deltaVsPrev).toBe(-10); // 40 - 50
    expect(b.deltaVsFirst).toBe(20); // 40 - 20
    expect(b.vsPeakPct).toBe(80); // 40/50
  });

  it("개별 키워드 실패는 건너뛰고 부분 결과 반환", async () => {
    const provider = stub({ A: pts([5, 6, 7]) }, ["Z"]);
    const out = await buildBrandTrendIndex(provider, { brand: "A", category: "Z" });
    expect(out.series.map((s) => s.keyword)).toEqual(["A"]);
    expect(out.hasData).toBe(true);
  });

  it("경쟁사는 maxCompetitors로 제한", async () => {
    const provider = stub({ A: pts([1, 2]), c1: pts([1]), c2: pts([1]), c3: pts([1]), c4: pts([1]) });
    const out = await buildBrandTrendIndex(provider, { brand: "A", category: "", competitors: ["c1", "c2", "c3", "c4"] }, { maxCompetitors: 2 });
    expect(out.series.filter((s) => s.role === "competitor")).toHaveLength(2);
  });

  it("데이터 전무 시 hasData=false, periods 빈배열", async () => {
    const provider = stub({});
    const out = await buildBrandTrendIndex(provider, { brand: "X", category: "Y" });
    expect(out.hasData).toBe(false);
    expect(out.periods).toEqual([]);
    expect(out.brand?.latest).toBeNull();
  });

  it("periods는 가장 긴 시계열을 x축으로", async () => {
    const provider = stub({ A: pts([1, 2, 3, 4]), B: pts([1, 2]) });
    const out = await buildBrandTrendIndex(provider, { brand: "A", category: "B" });
    expect(out.periods).toHaveLength(4);
  });
});
