import { describe, expect, it } from "vitest";
import { classifyNotification } from "@/domain/notifications";

describe("classifyNotification", () => {
  it("maps rank-guard alerts to RANK", () => {
    expect(classifyNotification("GUARD_RANK_UNEXPOSED").category).toBe("RANK");
    expect(classifyNotification("GUARD_RANK_BELOW_TARGET").category).toBe("RANK");
    expect(classifyNotification("GUARD_RANK_DROP").category).toBe("RANK");
  });

  it("maps approvals/confirmations to CONFIRM (before CLIENT)", () => {
    expect(classifyNotification("CLIENT_APPROVAL_OVERDUE").category).toBe("CONFIRM");
    expect(classifyNotification("CONTENT_CONFIRMED").category).toBe("CONFIRM");
  });

  it("maps client-facing events to CLIENT", () => {
    expect(classifyNotification("CLIENT_FEEDBACK").category).toBe("CLIENT");
    expect(classifyNotification("SURVEY_COMPLETED").category).toBe("CLIENT");
  });

  it("maps collaboration and HR", () => {
    expect(classifyNotification("MENTION").category).toBe("COLLAB");
    expect(classifyNotification("WORK_ASSIGNED").category).toBe("COLLAB");
    expect(classifyNotification("LEAVE_APPROVED").category).toBe("HR");
  });

  it("falls back to SYSTEM for unknown types", () => {
    expect(classifyNotification("SOMETHING_NEW").category).toBe("SYSTEM");
    expect(classifyNotification("").category).toBe("SYSTEM");
  });
});
