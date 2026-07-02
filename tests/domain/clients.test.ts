import { describe, expect, it } from "vitest";
import { clientFormSchema } from "@/domain/clients";

const validBase = {
  name: "테스트 거래처",
  code: "CLIENT-001"
};

describe("clientFormSchema", () => {
  it("accepts a minimal valid client and defaults active to true", () => {
    const parsed = clientFormSchema.parse(validBase);
    expect(parsed.name).toBe("테스트 거래처");
    expect(parsed.code).toBe("CLIENT-001");
    expect(parsed.active).toBe(true);
    expect(parsed.assignedMarketerId).toBeUndefined();
  });

  it("requires name and code", () => {
    const parsed = clientFormSchema.safeParse({ name: "", code: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("name");
      expect(paths).toContain("code");
    }
  });

  it("normalizes blank optional fields to undefined", () => {
    const parsed = clientFormSchema.parse({
      ...validBase,
      businessNumber: "  ",
      contactEmail: "",
      monthlyContractFee: "",
      assignedMarketerId: ""
    });
    expect(parsed.businessNumber).toBeUndefined();
    expect(parsed.contactEmail).toBeUndefined();
    expect(parsed.monthlyContractFee).toBeUndefined();
    expect(parsed.assignedMarketerId).toBeUndefined();
  });

  it("validates email format and coerces money to a non-negative integer", () => {
    expect(clientFormSchema.safeParse({ ...validBase, contactEmail: "not-an-email" }).success).toBe(false);
    expect(clientFormSchema.parse({ ...validBase, monthlyContractFee: "1500000" }).monthlyContractFee).toBe(1500000);
    expect(clientFormSchema.safeParse({ ...validBase, monthlyContractFee: "-5" }).success).toBe(false);
  });

  it("rejects a contract end date before the start date", () => {
    const invalid = clientFormSchema.safeParse({
      ...validBase,
      contractStartDate: "2026-06-30",
      contractEndDate: "2026-06-01"
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0]?.path).toEqual(["contractEndDate"]);
    }
  });

  it("coerces the active checkbox value", () => {
    expect(clientFormSchema.parse({ ...validBase, active: "true" }).active).toBe(true);
    expect(clientFormSchema.parse({ ...validBase, active: "false" }).active).toBe(false);
    expect(clientFormSchema.parse({ ...validBase, active: "on" }).active).toBe(true);
  });
});
