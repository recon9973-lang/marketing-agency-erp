import { describe, expect, it } from "vitest";
import { calendarEventHref } from "@/domain/calendar";

const empty = { workItemId: null, reportId: null, leaveRequestId: null, clientId: null };

describe("calendarEventHref", () => {
  it("links to the work item first", () => {
    expect(calendarEventHref({ ...empty, workItemId: "w1", clientId: "c1" })).toBe("/work/w1/edit");
  });

  it("links to the report when there is no work item", () => {
    expect(calendarEventHref({ ...empty, reportId: "r1", clientId: "c1" })).toBe("/reports/r1/edit");
  });

  it("links to leave for leave events", () => {
    expect(calendarEventHref({ ...empty, leaveRequestId: "l1" })).toBe("/leave");
  });

  it("falls back to the client ranks page", () => {
    expect(calendarEventHref({ ...empty, clientId: "c1" })).toBe("/clients/c1/ranks");
  });

  it("returns null when there is no source", () => {
    expect(calendarEventHref(empty)).toBeNull();
  });
});
