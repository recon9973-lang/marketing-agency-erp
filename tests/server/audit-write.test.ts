import { describe, expect, it } from "vitest";
import {
  writeAuditLog,
  createMockAuditRepository,
  AuditAction,
  type AuditLogRepository,
} from "@/server/audit";

describe("writeAuditLog", () => {
  it("persists actor, action, target, and before/after state", async () => {
    const repo = createMockAuditRepository();
    const result = await writeAuditLog(repo, {
      actorId: "admin-1",
      action: AuditAction.WORK_STATUS_CHANGED,
      targetType: "WorkItem",
      targetId: "work-1",
      summary: "IN_PROGRESS -> REVIEW_NEEDED",
      beforeState: { status: "IN_PROGRESS" },
      afterState: { status: "REVIEW_NEEDED" },
    });

    expect(result.written).toBe(true);
    expect(repo.records).toHaveLength(1);
    const record = repo.records[0];
    expect(record.actorId).toBe("admin-1");
    expect(record.action).toBe("WORK_STATUS_CHANGED");
    expect(record.afterState).toEqual({ status: "REVIEW_NEEDED" });
    expect(record.createdAt).toBeInstanceOf(Date);
  });

  it("does not throw and reports written:false when the repository fails", async () => {
    const failingRepo: AuditLogRepository = {
      async create() {
        throw new Error("db down");
      },
    };
    const result = await writeAuditLog(failingRepo, {
      actorId: null,
      action: AuditAction.LEAVE_APPROVED,
      targetType: "LeaveRequest",
      targetId: "leave-1",
    });
    // 정책: 감사 로그 실패는 본 작업을 막지 않는다.
    expect(result.written).toBe(false);
  });
});
