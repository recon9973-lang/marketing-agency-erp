import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportStatus } from "@/domain/types";
import { ErrorCode } from "@/server/errors";
import { adminUser, marketerUser, superAdminUser } from "../helpers/users";
import { expectFail, expectOk } from "../helpers/action-result";

const getCurrentUserMock = vi.fn();
const loadAccessScopesMock = vi.fn();
const getClientAccessInfoMock = vi.fn();
const createReportMock = vi.fn();
const updateReportMock = vi.fn();
const getReportAccessInfoMock = vi.fn();
const getReportDetailMock = vi.fn();
const changeReportStatusMock = vi.fn();
const writeAuditLogMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/server/scope", () => ({ loadAccessScopes: loadAccessScopesMock }));
vi.mock("@/server/repositories/clients", () => ({ getClientAccessInfo: getClientAccessInfoMock }));
vi.mock("@/server/repositories/reports", () => ({
  createReport: createReportMock,
  updateReport: updateReportMock,
  getReportAccessInfo: getReportAccessInfoMock,
  getReportDetail: getReportDetailMock,
  changeReportStatus: changeReportStatusMock
}));
vi.mock("@/server/audit", async () => {
  const actual = await vi.importActual<typeof import("@/server/audit")>("@/server/audit");
  return { ...actual, writeAuditLog: writeAuditLogMock };
});
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

async function loadActions() {
  return import("@/server/actions/report");
}

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

const validReport = { clientId: "c1", reportingMonth: "2026-06-01", title: "6월 보고서" };

beforeEach(() => {
  vi.clearAllMocks();
  loadAccessScopesMock.mockResolvedValue([]);
  writeAuditLogMock.mockResolvedValue(true);
});

describe("createReportAction", () => {
  it("lets a scoped marketer author a report", async () => {
    const { createReportAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
    getClientAccessInfoMock.mockResolvedValue({ id: "c1", assignedMarketerId: "marketer-1" });
    createReportMock.mockResolvedValue({ id: "report-1" });

    const result = await createReportAction(null, formData(validReport));

    expect(expectOk(result)).toEqual({ id: "report-1" });
    expect(createReportMock).toHaveBeenCalledWith(expect.objectContaining({ title: "6월 보고서" }), "marketer-1");
  });

  it("forbids authoring for an out-of-scope client", async () => {
    const { createReportAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
    getClientAccessInfoMock.mockResolvedValue({ id: "c1", assignedMarketerId: "marketer-2" });

    const result = await createReportAction(null, formData(validReport));
    expectFail(result, ErrorCode.FORBIDDEN);
  });
});

describe("changeReportStatusAction", () => {
  function accessInfo(status: ReportStatus, authorId = "marketer-1") {
    return { id: "report-1", clientId: "c1", authorId, status, clientAssignedMarketerId: "marketer-1" };
  }

  it("lets the author submit for review", async () => {
    const { changeReportStatusAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
    getReportAccessInfoMock.mockResolvedValue(accessInfo(ReportStatus.DRAFT));
    changeReportStatusMock.mockResolvedValue({ id: "report-1", status: ReportStatus.REVIEW_NEEDED });

    const result = await changeReportStatusAction(null, formData({ id: "report-1", action: "submit" }));

    expect(expectOk(result)).toEqual({ id: "report-1" });
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ action: "REPORT_SUBMITTED" }));
  });

  it("forbids a marketer from approving", async () => {
    const { changeReportStatusAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
    getReportAccessInfoMock.mockResolvedValue(accessInfo(ReportStatus.REVIEW_NEEDED));

    const result = await changeReportStatusAction(null, formData({ id: "report-1", action: "approve" }));
    expectFail(result, ErrorCode.FORBIDDEN);
    expect(changeReportStatusMock).not.toHaveBeenCalled();
  });

  it("lets an admin approve and stamps reviewer/reviewedAt", async () => {
    const { changeReportStatusAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(adminUser({ id: "admin-1" }));
    loadAccessScopesMock.mockResolvedValue([
      { adminId: "admin-1", marketerId: null, clientId: "c1", allMarketers: false, allClients: false }
    ]);
    getReportAccessInfoMock.mockResolvedValue(accessInfo(ReportStatus.REVIEW_NEEDED));
    changeReportStatusMock.mockResolvedValue({ id: "report-1", status: ReportStatus.APPROVED });

    const result = await changeReportStatusAction(null, formData({ id: "report-1", action: "approve" }));

    expect(expectOk(result)).toEqual({ id: "report-1" });
    const [, data] = changeReportStatusMock.mock.calls[0];
    expect(data.reviewerId).toBe("admin-1");
    expect(data.reviewedAt).toBeInstanceOf(Date);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ action: "REPORT_APPROVED" }));
  });

  it("rejects an invalid transition with a conflict", async () => {
    const { changeReportStatusAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getReportAccessInfoMock.mockResolvedValue(accessInfo(ReportStatus.DELIVERED));

    const result = await changeReportStatusAction(null, formData({ id: "report-1", action: "deliver" }));
    expectFail(result, ErrorCode.CONFLICT);
  });

  it("returns NOT_FOUND for a missing report", async () => {
    const { changeReportStatusAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getReportAccessInfoMock.mockResolvedValue(null);

    const result = await changeReportStatusAction(null, formData({ id: "missing", action: "submit" }));
    expectFail(result, ErrorCode.NOT_FOUND);
  });
});
