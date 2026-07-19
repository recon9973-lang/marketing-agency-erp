import { describe, expect, it } from "vitest";
import { computeLift, isInterventionKind, summarizeByKind, type Lift } from "./intervention";

describe("geo/intervention · computeLift", () => {
  it("상승/하락/미미/미측정 구분", () => {
    expect(computeLift(0.3, 0.5).direction).toBe("up"); // +20%p
    expect(computeLift(0.5, 0.3).direction).toBe("down"); // -20%p
    expect(computeLift(0.5, 0.52).direction).toBe("flat"); // +2%p < 5%p 대역
    expect(computeLift(null, 0.5).direction).toBe("pending");
    expect(computeLift(0.5, null).direction).toBe("pending");
  });
  it("deltaPoints는 %p 소수1자리", () => {
    expect(computeLift(0.3, 0.45).deltaPoints).toBe(15);
    expect(computeLift(0.4, 0.4).deltaPoints).toBe(0);
    expect(computeLift(null, 0.4).deltaPoints).toBeNull();
  });
  it("band 경계는 포함(>= 상승, <= 하락)", () => {
    expect(computeLift(0.5, 0.55).direction).toBe("up"); // 정확히 +5%p
    expect(computeLift(0.5, 0.45).direction).toBe("down"); // 정확히 -5%p
  });
});

describe("geo/intervention · summarizeByKind", () => {
  const mk = (kind: string, direction: Lift["direction"], deltaPoints: number | null) => ({
    kind,
    lift: { direction, deltaPoints } as Lift
  });
  it("pending 제외, 종류별 평균·상승비율 집계", () => {
    const rows = [
      mk("CONTENT_PUBLISH", "up", 20),
      mk("CONTENT_PUBLISH", "flat", 2),
      mk("CONTENT_PUBLISH", "pending", null), // 제외
      mk("KEYWORD_ADD", "down", -10)
    ];
    const sum = summarizeByKind(rows);
    const pub = sum.find((s) => s.kind === "CONTENT_PUBLISH")!;
    expect(pub.n).toBe(2); // pending 제외
    expect(pub.avgDeltaPoints).toBe(11); // (20+2)/2
    expect(pub.upRate).toBe(0.5); // 2건 중 1건 up
    const kw = sum.find((s) => s.kind === "KEYWORD_ADD")!;
    expect(kw.n).toBe(1);
    expect(kw.avgDeltaPoints).toBe(-10);
  });
  it("결과 없는 종류는 제외", () => {
    expect(summarizeByKind([mk("MANUAL", "pending", null)])).toEqual([]);
  });
});

describe("geo/intervention · isInterventionKind", () => {
  it("유효 종류만 통과", () => {
    expect(isInterventionKind("CONTENT_PUBLISH")).toBe(true);
    expect(isInterventionKind("NOPE")).toBe(false);
  });
});
