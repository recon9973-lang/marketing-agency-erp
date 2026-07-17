// GEO Studio · M2 CEP 파인더 — 오케스트레이터 구조·결정성 테스트.
// 목 파이프라인이 골든 검증된 하위 함수들을 올바르게 엮는지 확인(라이브 4-AI는 P0에서 주입).
import { describe, it, expect } from "vitest";
import { discoverCeps } from "./finder";

const OPTS = { competitors: ["블루하우스", "코지스테이"], scanDate: "2026-07-17T00:00:00.000Z" };

describe("M2 · discoverCeps (목 파이프라인)", () => {
  const r = discoverCeps("햇살숙소", "제주 숙소", OPTS) as {
    total_ceps: number;
    candidate_count: number;
    probe_count: number;
    ceps: Array<{ priority_score: number }>;
    top_ceps: string[];
    cep_share: Record<string, number>;
    whitespace_count: number;
    scan_date: string;
  };

  it("CEP를 실제로 발굴한다", () => {
    expect(r.probe_count).toBeGreaterThanOrEqual(26);
    expect(r.candidate_count).toBeGreaterThan(0);
    expect(r.total_ceps).toBeGreaterThan(0);
    expect(r.scan_date).toBe(OPTS.scanDate);
  });

  it("우선순위 내림차순 정렬", () => {
    const ps = r.ceps.map((c) => c.priority_score);
    expect(ps).toEqual([...ps].sort((a, b) => b - a));
  });

  it("top_ceps ≤ 10 · cep_share에 _brand 포함", () => {
    expect(r.top_ceps.length).toBeLessThanOrEqual(10);
    expect(r.cep_share).toHaveProperty("_brand");
    expect(r.whitespace_count).toBeLessThanOrEqual(r.total_ceps);
  });

  it("결정적 — 동일 입력 동일 출력", () => {
    expect(discoverCeps("햇살숙소", "제주 숙소", OPTS)).toEqual(r);
  });

  it("알 수 없는 플랫폼은 예외", () => {
    expect(() => discoverCeps("b", "c", { platforms: ["bing"] })).toThrow();
  });
});
