import { describe, expect, it } from "vitest";
import {
  requiredString,
  optionalString,
  amount,
  dateRange,
  paginationSchema,
  enumOf,
} from "@/domain/validation";

describe("validation helpers", () => {
  it("requiredString trims and enforces min length", () => {
    expect(requiredString("이름").parse("  홍길동  ")).toBe("홍길동");
    expect(requiredString("이름").safeParse("   ").success).toBe(false);
  });

  it("optionalString maps empty to undefined", () => {
    expect(optionalString().parse("")).toBeUndefined();
    expect(optionalString().parse("  메모 ")).toBe("메모");
  });

  it("amount rejects negatives and non-integers, accepts numeric strings", () => {
    expect(amount("금액").parse("15000")).toBe(15000);
    expect(amount("금액").safeParse(-1).success).toBe(false);
    expect(amount("금액").safeParse(10.5).success).toBe(false);
  });

  it("dateRange rejects start after end", () => {
    expect(dateRange().safeParse({ start: "2026-01-01", end: "2026-02-01" }).success).toBe(true);
    expect(dateRange().safeParse({ start: "2026-03-01", end: "2026-02-01" }).success).toBe(false);
  });

  it("paginationSchema applies defaults and caps pageSize", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(paginationSchema.safeParse({ pageSize: 1000 }).success).toBe(false);
  });

  it("enumOf validates against allowed values", () => {
    const status = enumOf(["OPEN", "CLOSED"] as const, "상태");
    expect(status.parse("OPEN")).toBe("OPEN");
    expect(status.safeParse("NOPE").success).toBe(false);
  });
});
