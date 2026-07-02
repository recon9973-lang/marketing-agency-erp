import { describe, expect, it, vi } from "vitest";
import {
  AuditActions,
  buildAuditSummary,
  writeAuditLog,
  type AuditLogRecord,
  type AuditLogRepository
} from "@/server/audit";

function makeMockRepository() {
  const records: AuditLogRecord[] = [];
  const repository: AuditLogRepository = {
    create: async (record) => {
      records.push(record);
      return record;
    }
  };

  return { records, repository };
}

describe("writeAuditLog", () => {
  it("persists actor, action, target and states through the repository", async () => {
    const { records, repository } = makeMockRepository();

    const result = await writeAuditLog(
      {
        actorId: "admin-1",
        action: AuditActions.LEAVE_APPROVED,
        targetType: "LeaveRequest",
        targetId: "leave-1",
        beforeState: { status: "PENDING" },
        afterState: { status: "APPROVED" }
      },
      repository
    );

    expect(result).toEqual({ ok: true });
    expect(records).toEqual([
      {
        actorId: "admin-1",
        action: "LEAVE_APPROVED",
        targetType: "LeaveRequest",
        targetId: "leave-1",
        beforeState: { status: "PENDING" },
        afterState: { status: "APPROVED" },
        ipAddress: undefined,
        userAgent: undefined
      }
    ]);
  });

  it("supports system events without an actor", async () => {
    const { records, repository } = makeMockRepository();

    const result = await writeAuditLog(
      {
        actorId: null,
        action: AuditActions.BILLING_UPDATED,
        targetType: "BillingRecord",
        targetId: "billing-1"
      },
      repository
    );

    expect(result.ok).toBe(true);
    expect(records[0]?.actorId).toBeNull();
  });

  it("never throws when the repository fails and reports the failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("db unavailable");
    const repository: AuditLogRepository = {
      create: async () => {
        throw failure;
      }
    };

    const result = await writeAuditLog(
      {
        actorId: "admin-1",
        action: AuditActions.WORK_STATUS_CHANGED,
        targetType: "WorkItem",
        targetId: "work-1"
      },
      repository
    );

    expect(result).toEqual({ ok: false, error: failure });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe("buildAuditSummary", () => {
  it("summarizes the action, target and actor", () => {
    expect(
      buildAuditSummary({
        actorId: "admin-1",
        action: AuditActions.EXPENSE_REVIEWED,
        targetType: "ExpenseRecord",
        targetId: "expense-1"
      })
    ).toBe("EXPENSE_REVIEWED ExpenseRecord#expense-1 by admin-1");

    expect(
      buildAuditSummary({
        actorId: null,
        action: AuditActions.REPORT_APPROVED,
        targetType: "Report",
        targetId: "report-1"
      })
    ).toBe("REPORT_APPROVED Report#report-1 by system");
  });
});
