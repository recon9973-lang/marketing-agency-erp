import { describe, expect, it, vi } from "vitest";
import { AuditAction, writeAuditLog } from "@/server/audit";
import { createFailingAuditRepository, createMockAuditRepository } from "../helpers/audit";

describe("writeAuditLog", () => {
  it("persists actor, action, target and before/after state", async () => {
    const { repository, records } = createMockAuditRepository();

    const result = await writeAuditLog(
      {
        actorId: "admin-1",
        action: AuditAction.WORK_STATUS_CHANGED,
        targetType: "WorkItem",
        targetId: "work-1",
        beforeState: { status: "IN_PROGRESS" },
        afterState: { status: "REVIEW_NEEDED" }
      },
      repository
    );

    expect(result).toBe(true);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      actorId: "admin-1",
      action: "WORK_STATUS_CHANGED",
      targetType: "WorkItem",
      targetId: "work-1",
      beforeState: { status: "IN_PROGRESS" },
      afterState: { status: "REVIEW_NEEDED" }
    });
  });

  it("omits optional state when not provided", async () => {
    const { repository, records } = createMockAuditRepository();

    await writeAuditLog(
      { actorId: null, action: AuditAction.SETTINGS_UPDATED, targetType: "Settings", targetId: "global" },
      repository
    );

    expect(records[0]).not.toHaveProperty("beforeState");
    expect(records[0]).not.toHaveProperty("afterState");
  });

  it("does not block the caller when audit persistence fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { repository } = createFailingAuditRepository();

    const result = await writeAuditLog(
      { actorId: "admin-1", action: AuditAction.LEAVE_APPROVED, targetType: "LeaveRequest", targetId: "leave-1" },
      repository
    );

    expect(result).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
