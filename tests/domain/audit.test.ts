import { describe, expect, it } from "vitest";
import { buildAuditEvent } from "@/server/audit";

describe("audit events", () => {
  it("records actor, action, target, and summary", () => {
    const event = buildAuditEvent({
      actorId: "user-1",
      action: "WORK_STATUS_CHANGED",
      targetType: "WorkItem",
      targetId: "work-1",
      summary: "IN_PROGRESS -> REVIEW_NEEDED"
    });
    expect(event.actorId).toBe("user-1");
    expect(event.summary).toContain("REVIEW_NEEDED");
  });
});
