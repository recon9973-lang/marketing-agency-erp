import { describe, expect, it } from "vitest";
import { nextReportStatus, reportFormSchema } from "@/domain/report";
import { ReportStatus } from "@/domain/types";

describe("nextReportStatus", () => {
  it("walks the review lifecycle", () => {
    expect(nextReportStatus(ReportStatus.DRAFT, "submit")).toBe(ReportStatus.REVIEW_NEEDED);
    expect(nextReportStatus(ReportStatus.REVIEW_NEEDED, "approve")).toBe(ReportStatus.APPROVED);
    expect(nextReportStatus(ReportStatus.APPROVED, "deliver")).toBe(ReportStatus.DELIVERED);
    expect(nextReportStatus(ReportStatus.REVIEW_NEEDED, "return")).toBe(ReportStatus.DRAFT);
  });

  it("keeps the status for invalid transitions", () => {
    expect(nextReportStatus(ReportStatus.DRAFT, "approve")).toBe(ReportStatus.DRAFT);
    expect(nextReportStatus(ReportStatus.DELIVERED, "deliver")).toBe(ReportStatus.DELIVERED);
  });
});

describe("reportFormSchema", () => {
  const valid = { clientId: "c1", reportingMonth: "2026-06-01", title: "6월 월간 보고서" };

  it("parses a valid report", () => {
    expect(reportFormSchema.parse(valid).title).toBe("6월 월간 보고서");
  });

  it("requires client, month and title", () => {
    const parsed = reportFormSchema.safeParse({ clientId: "", reportingMonth: "bad", title: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toEqual(expect.arrayContaining(["clientId", "reportingMonth", "title"]));
    }
  });
});
