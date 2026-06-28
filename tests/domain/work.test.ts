import { describe, expect, it } from "vitest";
import { isWorkDelayed, nextWorkStatus } from "@/domain/work";
import { WorkStatus } from "@/domain/types";

describe("work rules", () => {
  it("marks incomplete past-due work as delayed", () => {
    expect(isWorkDelayed({ status: WorkStatus.IN_PROGRESS, dueDate: "2026-06-01" }, "2026-06-28")).toBe(true);
    expect(isWorkDelayed({ status: WorkStatus.COMPLETED, dueDate: "2026-06-01" }, "2026-06-28")).toBe(false);
  });

  it("moves in-progress work to review needed", () => {
    expect(nextWorkStatus(WorkStatus.IN_PROGRESS, "submit_for_review")).toBe(WorkStatus.REVIEW_NEEDED);
  });
});
