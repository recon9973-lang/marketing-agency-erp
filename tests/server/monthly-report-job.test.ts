import { beforeEach, describe, expect, it, vi } from "vitest";

const clientFindMany = vi.fn();
const reportFindUnique = vi.fn();
const auditCreate = vi.fn();
const buildMock = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    client: { findMany: clientFindMany },
    report: { findUnique: reportFindUnique },
    auditLog: { create: auditCreate }
  }
}));

vi.mock("@/server/marketing/monthly-report", () => ({
  buildMonthlyReportDraft: buildMock
}));

describe("runMonthlyReportDrafts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    auditCreate.mockResolvedValue({});
  });

  it("reports on the previous month, skips existing, creates missing, isolates failures", async () => {
    clientFindMany.mockResolvedValue([
      { id: "c1", name: "A병원", assignedMarketerId: "m1" }, // 이미 보고서 있음 → skip
      { id: "c2", name: "B병원", assignedMarketerId: "m2" }, // 없음 → create
      { id: "c3", name: "C병원", assignedMarketerId: "m3" } // 빌더 실패 → failed
    ]);
    reportFindUnique.mockImplementation(({ where }: { where: { clientId_reportingMonth: { clientId: string } } }) =>
      Promise.resolve(where.clientId_reportingMonth.clientId === "c1" ? { id: "r1" } : null)
    );
    buildMock.mockImplementation(({ clientId }: { clientId: string }) => {
      if (clientId === "c3") throw new Error("boom");
      return Promise.resolve({ id: `rep-${clientId}`, created: true, stats: { completedWork: 1, publishedContent: 2, products: 3 } });
    });

    const { runMonthlyReportDrafts } = await import("@/server/jobs/monthly-report");
    const result = await runMonthlyReportDrafts(new Date("2026-08-05T00:00:00.000Z"));

    expect(result.reportingMonth).toBe("2026-07");
    expect(result.clients).toBe(3);
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(1);
    expect(result.failed).toBe(1);

    // 생성이 있었으니 배치 감사로그를 남긴다.
    expect(auditCreate).toHaveBeenCalledTimes(1);
    // 담당 마케터가 작성자로 전달된다.
    expect(buildMock).toHaveBeenCalledWith(expect.objectContaining({ clientId: "c2", authorId: "m2", reportingMonth: "2026-07" }));
  });

  it("handles January rollover to previous December", async () => {
    clientFindMany.mockResolvedValue([]);
    const { runMonthlyReportDrafts } = await import("@/server/jobs/monthly-report");
    const result = await runMonthlyReportDrafts(new Date("2026-01-01T00:00:00.000Z"));
    expect(result.reportingMonth).toBe("2025-12");
    expect(result.clients).toBe(0);
  });
});
