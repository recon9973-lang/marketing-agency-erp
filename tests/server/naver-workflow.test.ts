import { describe, expect, it } from "vitest";
import { gradeByVolume, gradeDistribution } from "@/domain/marketing/keyword-grade";
import {
  NAVER_CHANNELS,
  naverChannelLabels,
  naverChannelsByPriority,
  isNaverChannel,
  NAVER_CHANNEL_PLAYBOOK,
} from "@/domain/marketing/naver-channels";
import { fetchRelatedKeywords } from "@/server/integrations/naver-search";

describe("네이버 6단계 ④ — 검색량 A/B/C 등급", () => {
  it("스펙 예시 임계값에 맞게 분류한다", () => {
    expect(gradeByVolume(90500)).toBe("A");
    expect(gradeByVolume(33100)).toBe("A");
    expect(gradeByVolume(18200)).toBe("B");
    expect(gradeByVolume(8900)).toBe("B");
    expect(gradeByVolume(500)).toBe("C");
    expect(gradeByVolume(null)).toBe("C");
  });

  it("등급 분포를 집계한다", () => {
    expect(gradeDistribution([90500, 18200, 8900, 100])).toEqual({ A: 1, B: 2, C: 1 });
  });
});

describe("네이버 10채널 택소노미", () => {
  it("10개 채널 + 라벨 + 노출순서", () => {
    expect(NAVER_CHANNELS).toHaveLength(10);
    for (const c of NAVER_CHANNELS) expect(naverChannelLabels[c]).toBeTruthy();
    const ordered = naverChannelsByPriority();
    expect(ordered[0].channel).toBe("powerlink"); // 노출 1순위
    expect(ordered.map((p) => p.order)).toEqual([...ordered.map((p) => p.order)].sort((a, b) => a - b));
    expect(NAVER_CHANNEL_PLAYBOOK).toHaveLength(10);
  });

  it("채널 판별 가드", () => {
    expect(isNaverChannel("blog")).toBe(true);
    expect(isNaverChannel("kin")).toBe(true);
    expect(isNaverChannel("nope")).toBe(false);
  });
});

describe("네이버 6단계 ③ — 연관 키워드 확장(데모)", () => {
  it("미연동 시 씨드별 파생 연관어를 씨드 제외하고 반환한다", async () => {
    const rel = await fetchRelatedKeywords(["강남치과"]);
    expect(rel.length).toBeGreaterThan(0);
    expect(rel.every((r) => r.estimated)).toBe(true);
    expect(rel.some((r) => r.keyword.replace(/\s+/g, "") === "강남치과")).toBe(false);
  });

  it("빈 씨드는 빈 배열", async () => {
    expect(await fetchRelatedKeywords([])).toEqual([]);
  });
});
