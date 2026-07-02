import { describe, expect, it } from "vitest";
import {
  dateRangeSchema,
  isoDateSchema,
  moneyAmountSchema,
  nativeEnumValue,
  optionalString,
  paginationSchema,
  requiredString
} from "@/domain/validation";
import { Role } from "@/domain/types";

describe("requiredString", () => {
  it("trims input and rejects empty values", () => {
    expect(requiredString("거래처명").parse("  A 병원  ")).toBe("A 병원");
    expect(requiredString("거래처명").safeParse("   ").success).toBe(false);
    expect(requiredString("거래처명").safeParse(undefined).success).toBe(false);
  });

  it("enforces max length", () => {
    expect(requiredString("메모", { max: 3 }).safeParse("가나다라").success).toBe(false);
  });
});

describe("optionalString", () => {
  it("turns empty strings into undefined", () => {
    expect(optionalString().parse("  ")).toBeUndefined();
    expect(optionalString().parse(undefined)).toBeUndefined();
    expect(optionalString().parse(" 메모 ")).toBe("메모");
  });
});

describe("moneyAmountSchema", () => {
  it("accepts coerced non-negative integer amounts", () => {
    expect(moneyAmountSchema.parse("150000")).toBe(150000);
    expect(moneyAmountSchema.parse(0)).toBe(0);
  });

  it("rejects negative, fractional, and non-numeric amounts", () => {
    expect(moneyAmountSchema.safeParse(-1).success).toBe(false);
    expect(moneyAmountSchema.safeParse(1000.5).success).toBe(false);
    expect(moneyAmountSchema.safeParse("십만원").success).toBe(false);
  });
});

describe("isoDateSchema / dateRangeSchema", () => {
  it("accepts valid dates and rejects malformed or impossible dates", () => {
    expect(isoDateSchema.parse("2026-07-02")).toBe("2026-07-02");
    expect(isoDateSchema.safeParse("2026-7-2").success).toBe(false);
    expect(isoDateSchema.safeParse("2026-02-30").success).toBe(false);
  });

  it("rejects ranges where the end precedes the start", () => {
    expect(dateRangeSchema.safeParse({ startDate: "2026-07-01", endDate: "2026-07-03" }).success).toBe(true);

    const reversed = dateRangeSchema.safeParse({ startDate: "2026-07-03", endDate: "2026-07-01" });
    expect(reversed.success).toBe(false);

    if (!reversed.success) {
      expect(reversed.error.issues[0]?.path).toEqual(["endDate"]);
    }
  });
});

describe("nativeEnumValue", () => {
  it("accepts enum members and rejects unknown values with a labeled message", () => {
    const schema = nativeEnumValue(Role, "역할");

    expect(schema.parse(Role.ADMIN)).toBe(Role.ADMIN);

    const invalid = schema.safeParse("OWNER");
    expect(invalid.success).toBe(false);

    if (!invalid.success) {
      expect(invalid.error.issues[0]?.message).toBe("허용되지 않는 역할입니다.");
    }
  });
});

describe("paginationSchema", () => {
  it("applies defaults and coerces string query values", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationSchema.parse({ page: "3", pageSize: "50" })).toEqual({ page: 3, pageSize: 50 });
  });

  it("rejects out-of-range values", () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(paginationSchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});
