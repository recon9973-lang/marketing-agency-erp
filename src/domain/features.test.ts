import { describe, expect, it } from "vitest";
import { Role } from "./types";
import { canUseFeature, parseFeatureKeys } from "./features";

describe("canUseFeature — 기능 차단(deniedFeatures) 축", () => {
  it("SUPER_ADMIN은 차단 목록과 무관하게 항상 허용", () => {
    expect(canUseFeature(Role.SUPER_ADMIN, ["finance", "contracts"], "finance")).toBe(true);
  });

  it("ADMIN·MARKETER는 차단 목록에 없으면 허용", () => {
    expect(canUseFeature(Role.ADMIN, [], "finance")).toBe(true);
    expect(canUseFeature(Role.MARKETER, ["contracts"], "leads")).toBe(true);
  });

  it("ADMIN·MARKETER는 차단된 기능은 거부", () => {
    expect(canUseFeature(Role.ADMIN, ["finance"], "finance")).toBe(false);
    expect(canUseFeature(Role.MARKETER, ["leave", "leads"], "leave")).toBe(false);
  });
});

describe("parseFeatureKeys — 방어적 파싱", () => {
  it("유효 키만 통과, 잡값·중복형 제거", () => {
    expect(parseFeatureKeys(["finance", "contracts", "bogus", 42, null])).toEqual(["finance", "contracts"]);
  });

  it("배열 아니면 빈 배열", () => {
    expect(parseFeatureKeys("finance")).toEqual([]);
    expect(parseFeatureKeys(undefined)).toEqual([]);
    expect(parseFeatureKeys(null)).toEqual([]);
  });
});
