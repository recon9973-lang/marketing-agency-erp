import { describe, expect, it } from "vitest";
import {
  BillingStatus,
  CalendarEventKind,
  CalendarProvider,
  ClientAccountPlatform,
  ConnectionStatus,
  ExpenseReviewStatus,
  FinancialAccountType,
  LeaveStatus,
  LeaveType,
  PaymentMethod,
  PaymentProvider,
  ReportStatus,
  Role,
  UserStatus,
  WorkCategory,
  WorkStatus
} from "@/domain/types";

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

  it("re-exports the schema enums used by the app layer", () => {
    expect(UserStatus.ACTIVE).toBe("ACTIVE");
    expect(WorkCategory.MONTHLY_REPORT).toBe("MONTHLY_REPORT");
    expect(ExpenseReviewStatus.NEEDS_FOLLOW_UP).toBe("NEEDS_FOLLOW_UP");
    expect(LeaveStatus.APPROVED).toBe("APPROVED");
    expect(LeaveType.HALF_DAY_PM).toBe("HALF_DAY_PM");
    expect(ReportStatus.REVIEW_NEEDED).toBe("REVIEW_NEEDED");
    expect(CalendarProvider.GOOGLE).toBe("GOOGLE");
    expect(CalendarEventKind.LEAVE).toBe("LEAVE");
    expect(PaymentMethod.BANK_TRANSFER).toBe("BANK_TRANSFER");
    expect(PaymentProvider.MANUAL).toBe("MANUAL");
    expect(FinancialAccountType.CARD).toBe("CARD");
    expect(ConnectionStatus.ERROR).toBe("ERROR");
    expect(ClientAccountPlatform.SNS).toBe("SNS");
  });
});
