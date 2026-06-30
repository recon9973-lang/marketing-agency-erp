import { describe, expect, it } from "vitest";
import { workFormSchema, workStatusTimestamps } from "@/domain/work";
import { WorkCategory, WorkStatus } from "@/domain/types";

const validBase = {
  clientId: "client-1",
  ownerId: "marketer-1",
  title: "6월 블로그 작성",
  category: WorkCategory.BRAND_BLOG,
  priority: "3"
};

describe("workFormSchema", () => {
  it("parses a valid work item and coerces priority", () => {
    const parsed = workFormSchema.parse(validBase);
    expect(parsed.priority).toBe(3);
    expect(parsed.category).toBe(WorkCategory.BRAND_BLOG);
    expect(parsed.dueDate).toBeUndefined();
  });

  it("requires client, owner, title and category", () => {
    const parsed = workFormSchema.safeParse({ clientId: "", ownerId: "", title: "", category: "NOPE", priority: "3" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toEqual(expect.arrayContaining(["clientId", "ownerId", "title", "category"]));
    }
  });

  it("bounds priority to 1..5", () => {
    expect(workFormSchema.safeParse({ ...validBase, priority: "0" }).success).toBe(false);
    expect(workFormSchema.safeParse({ ...validBase, priority: "6" }).success).toBe(false);
  });
});

describe("workStatusTimestamps", () => {
  const now = new Date("2026-06-30T00:00:00.000Z");

  it("stamps startedAt on first transition to IN_PROGRESS", () => {
    expect(workStatusTimestamps(WorkStatus.IN_PROGRESS, { startedAt: null }, now)).toEqual({ startedAt: now });
    expect(workStatusTimestamps(WorkStatus.IN_PROGRESS, { startedAt: new Date("2026-01-01") }, now)).toEqual({});
  });

  it("stamps completedAt on transition to COMPLETED", () => {
    expect(workStatusTimestamps(WorkStatus.COMPLETED, { completedAt: null }, now)).toEqual({ completedAt: now });
  });

  it("stamps nothing for other statuses", () => {
    expect(workStatusTimestamps(WorkStatus.BLOCKED, {}, now)).toEqual({});
  });
});
