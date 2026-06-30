import { describe, expect, it } from "vitest";
import {
  amountSchema,
  dateRangeSchema,
  enumSchema,
  isoDateSchema,
  optionalString,
  paginationSchema,
  requiredString
} from "@/domain/validation";
import { WorkStatus } from "@/domain/types";

describe("requiredString", () => {
  it("trims and rejects empty values", () => {
    expect(requiredString("이름").parse("  김마케터 ")).toBe("김마케터");
    expect(requiredString("이름").safeParse("   ").success).toBe(false);
  });

  it("enforces a max length", () => {
    expect(requiredString("이름", 3).safeParse("abcd").success).toBe(false);
  });
});

describe("optionalString", () => {
  it("normalizes blank input to undefined", () => {
    expect(optionalString().parse("   ")).toBeUndefined();
    expect(optionalString().parse(" hi ")).toBe("hi");
  });
});

describe("amountSchema", () => {
  it("accepts non-negative integer amounts and coerces strings", () => {
    expect(amountSchema().parse("1500")).toBe(1500);
    expect(amountSchema().parse(0)).toBe(0);
  });

  it("rejects negatives and non-integers", () => {
    expect(amountSchema().safeParse(-1).success).toBe(false);
    expect(amountSchema().safeParse(10.5).success).toBe(false);
  });
});

describe("isoDateSchema and dateRangeSchema", () => {
  it("accepts well-formed ISO dates", () => {
    expect(isoDateSchema.safeParse("2026-06-30").success).toBe(true);
    expect(isoDateSchema.safeParse("2026/06/30").success).toBe(false);
  });

  it("requires the end date to be on or after the start date", () => {
    expect(dateRangeSchema.safeParse({ startDate: "2026-06-01", endDate: "2026-06-30" }).success).toBe(true);
    const invalid = dateRangeSchema.safeParse({ startDate: "2026-06-30", endDate: "2026-06-01" });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0]?.path).toEqual(["endDate"]);
    }
  });
});

describe("enumSchema", () => {
  it("accepts valid enum values and rejects others", () => {
    const schema = enumSchema(WorkStatus, "업무 상태");
    expect(schema.parse(WorkStatus.IN_PROGRESS)).toBe(WorkStatus.IN_PROGRESS);
    expect(schema.safeParse("NOPE").success).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("fills defaults and clamps bounds", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(paginationSchema.safeParse({ pageSize: 1000 }).success).toBe(false);
  });
});
