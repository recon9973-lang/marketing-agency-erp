import { describe, expect, it } from "vitest";
import { diffWeights, learnWeights, shouldProposeVersion } from "./learning";
import type { KindSummary } from "./intervention";

const mk = (kind: string, avgDeltaPoints: number, upRate: number, n: number): KindSummary => ({
  kind,
  label: kind,
  n,
  avgDeltaPoints,
  upRate
});

describe("geo/learning · learnWeights", () => {
  it("상승폭·상승률·표본이 클수록 가중치 큼, 합계≈100", () => {
    const m = learnWeights([mk("CONTENT_PUBLISH", 20, 0.8, 10), mk("KEYWORD_ADD", 5, 0.4, 6)]);
    const pub = m.weights.find((w) => w.kind === "CONTENT_PUBLISH")!;
    const kw = m.weights.find((w) => w.kind === "KEYWORD_ADD")!;
    expect(pub.weight).toBeGreaterThan(kw.weight);
    expect(Math.round(m.weights.reduce((s, w) => s + w.weight, 0))).toBe(100);
    expect(m.basisCount).toBe(16);
    expect(m.summary).toContain("콘텐츠 발행"); // 라벨로 표기
  });
  it("하락(음수 상승폭)은 가중치 0으로", () => {
    const m = learnWeights([mk("CONTENT_REWRITE", -10, 0.1, 8)]);
    expect(m.weights[0].weight).toBe(0);
    expect(m.summary).toContain("부족");
  });
  it("표본이 작으면 축소로 신뢰 낮춤", () => {
    const big = learnWeights([mk("A", 20, 1, 100)]).weights[0];
    const small = learnWeights([mk("A", 20, 1, 1)]).weights[0];
    // 단독 종류라 둘 다 weight=100이지만 avgLift/n은 그대로 보존(설명가능)
    expect(big.n).toBe(100);
    expect(small.n).toBe(1);
  });
});

describe("geo/learning · diffWeights", () => {
  it("신규·제거·증감 변화 큰 순", () => {
    const prev = learnWeights([mk("A", 10, 1, 10), mk("B", 10, 1, 10)]).weights;
    const next = learnWeights([mk("A", 30, 1, 10), mk("B", 2, 1, 10)]).weights;
    const d = diffWeights(prev, next);
    expect(d[0].kind).toBe("A"); // A가 크게 상승
    expect(d.find((x) => x.kind === "A")!.delta).toBeGreaterThan(0);
  });
});

describe("geo/learning · shouldProposeVersion", () => {
  it("표본 부족이면 제안 안 함", () => {
    const next = learnWeights([mk("A", 20, 1, 2)]);
    expect(shouldProposeVersion(null, next, 5)).toBe(false);
  });
  it("첫 유효 모델은 제안", () => {
    const next = learnWeights([mk("A", 20, 1, 10)]);
    expect(shouldProposeVersion(null, next, 5)).toBe(true);
  });
  it("직전 대비 변화 작으면 제안 안 함", () => {
    const prev = learnWeights([mk("A", 20, 1, 10)]);
    const next = learnWeights([mk("A", 20.5, 1, 11)]);
    expect(shouldProposeVersion(prev.weights, next, 5, 5)).toBe(false);
  });
});
