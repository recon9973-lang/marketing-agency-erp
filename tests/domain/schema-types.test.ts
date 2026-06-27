import { describe, expect, it } from "vitest";
import { BillingStatus, Role, WorkStatus } from "@/domain/types";

describe("domain enums", () => {
  it("defines the required roles", () => {
    expect(Role.SUPER_ADMIN).toBe("SUPER_ADMIN");
    expect(Role.ADMIN).toBe("ADMIN");
    expect(Role.MARKETER).toBe("MARKETER");
  });

  it("defines work and billing states", () => {
    expect(WorkStatus.REVIEW_NEEDED).toBe("REVIEW_NEEDED");
    expect(BillingStatus.PARTIALLY_PAID).toBe("PARTIALLY_PAID");
  });
});
