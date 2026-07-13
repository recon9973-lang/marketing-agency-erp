import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildWeeklyPlan } from "@/domain/content/naver-schedule";

describe("네이버 6단계 ⑥ — 주간 발행 스케줄", () => {
  it("요일 슬롯에 등급별 키워드를 순서대로 배정한다", () => {
    const plan = buildWeeklyPlan(
      { A: ["a1", "a2"], B: ["b1"], C: ["c1", "c2"] },
      new Date("2026-07-13T00:00:00Z"), // 월요일
    );
    const byDay = Object.fromEntries(plan.map((p) => [p.slot.day, p]));
    expect(byDay["월"].keyword).toBe("a1"); // 월=A
    expect(byDay["화"].keyword).toBe("b1"); // 화=B
    expect(byDay["수"].keyword).toBe(null); // 수=B(소진)
    expect(byDay["목"].keyword).toBe("a2"); // 목=A
    expect(byDay["금"].keyword).toBe("c1"); // 금=C
    expect(byDay["토"].keyword).toBe("c2"); // 토=C
    expect(byDay["일"].keyword).toBe(null); // 일=발행없음
    expect(plan).toHaveLength(7);
    expect(byDay["월"].date).toBe("2026-07-13");
  });
});

const findMany = vi.fn();
const update = vi.fn();
const fetchVols = vi.fn();
vi.mock("@/server/db", () => ({ db: { keyword: { findMany, update } } }));
vi.mock("@/server/integrations/naver-search", () => ({ fetchKeywordVolumes: fetchVols }));

describe("네이버 검색량 배치 잡", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    update.mockResolvedValue({});
  });

  it("검색량 미상 키워드를 조회해 등급과 함께 갱신한다", async () => {
    findMany.mockResolvedValue([
      { id: "k1", keyword: "강남치과" },
      { id: "k2", keyword: "임플란트 비용" },
    ]);
    fetchVols.mockResolvedValue([
      { keyword: "강남치과", total: 30000, competition: "높음", estimated: false },
      { keyword: "임플란트 비용", total: 5000, competition: "중간", estimated: false },
    ]);
    const { runNaverVolumeEnrich } = await import("@/server/jobs/naver-volume");
    const r = await runNaverVolumeEnrich("c1");
    expect(r).toMatchObject({ processed: 2, updated: 2, failed: 0 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "k1" }, data: expect.objectContaining({ searchVolume: 30000, grade: "A" }) }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "k2" }, data: expect.objectContaining({ searchVolume: 5000, grade: "B" }) }),
    );
  });

  it("조회 실패 청크는 failed로 격리한다", async () => {
    findMany.mockResolvedValue([{ id: "k1", keyword: "x" }]);
    fetchVols.mockRejectedValue(new Error("429"));
    const { runNaverVolumeEnrich } = await import("@/server/jobs/naver-volume");
    const r = await runNaverVolumeEnrich("c1");
    expect(r.failed).toBe(1);
    expect(r.updated).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});
