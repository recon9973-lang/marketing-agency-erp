import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeaveStatus, LeaveType } from "@/domain/types";
import { ErrorCode } from "@/server/errors";
import { adminUser, marketerUser } from "../helpers/users";
import { expectFail, expectOk } from "../helpers/action-result";

const getCurrentUserMock = vi.fn();
const loadAccessScopesMock = vi.fn();
const createLeaveRequestMock = vi.fn();
const decideLeaveRequestMock = vi.fn();
const getLeaveRequestAccessInfoMock = vi.fn();
const writeAuditLogMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/server/scope", () => ({ loadAccessScopes: loadAccessScopesMock }));
vi.mock("@/server/repositories/leave", () => ({
  createLeaveRequest: createLeaveRequestMock,
  decideLeaveRequest: decideLeaveRequestMock,
  getLeaveRequestAccessInfo: getLeaveRequestAccessInfoMock
}));
vi.mock("@/server/audit", async () => {
  const actual = await vi.importActual<typeof import("@/server/audit")>("@/server/audit");
  return { ...actual, writeAuditLog: writeAuditLogMock };
});
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

async function loadActions() {
  return import("@/server/actions/leave");
}

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

const validRequest = {
  type: LeaveType.ANNUAL,
  startDate: "2026-07-01",
  endDate: "2026-07-03",
  daysRequested: "3"
};

beforeEach(() => {
  vi.clearAllMocks();
  loadAccessScopesMock.mockResolvedValue([]);
  writeAuditLogMock.mockResolvedValue(true);
});

describe("createLeaveRequestAction", () => {
  it("creates a leave request for the current user", async () => {
    const { createLeaveRequestAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
    createLeaveRequestMock.mockResolvedValue({ id: "leave-new" });

    const result = await createLeaveRequestAction(null, formData(validRequest));

    expect(expectOk(result)).toEqual({ id: "leave-new" });
    expect(createLeaveRequestMock).toHaveBeenCalledWith(expect.objectContaining({ daysRequested: 3 }), "marketer-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/leave");
  });

  it("rejects an invalid date range", async () => {
    const { createLeaveRequestAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser());

    const result = await createLeaveRequestAction(null, formData({ ...validRequest, startDate: "2026-07-05", endDate: "2026-07-01" }));

    const error = expectFail(result, ErrorCode.VALIDATION_ERROR);
    expect(error.fieldErrors?.endDate).toBeDefined();
  });
});

describe("decideLeaveRequestAction", () => {
  it("approves a scoped marketer's request and audits it", async () => {
    const { decideLeaveRequestAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(adminUser({ id: "admin-1" }));
    loadAccessScopesMock.mockResolvedValue([
      { adminId: "admin-1", marketerId: "marketer-1", clientId: null, allMarketers: false, allClients: false }
    ]);
    getLeaveRequestAccessInfoMock.mockResolvedValue({ id: "leave-1", requesterId: "marketer-1", status: LeaveStatus.REQUESTED });
    decideLeaveRequestMock.mockResolvedValue({ id: "leave-1", status: LeaveStatus.APPROVED });

    const result = await decideLeaveRequestAction(null, formData({ id: "leave-1", action: "approve" }));

    expect(expectOk(result)).toEqual({ id: "leave-1" });
    const [, data] = decideLeaveRequestMock.mock.calls[0];
    expect(data.status).toBe(LeaveStatus.APPROVED);
    expect(data.approverId).toBe("admin-1");
    expect(data.reviewedAt).toBeInstanceOf(Date);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ action: "LEAVE_APPROVED" }));
  });

  it("forbids an admin from approving an out-of-scope marketer", async () => {
    const { decideLeaveRequestAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(adminUser({ id: "admin-1" }));
    loadAccessScopesMock.mockResolvedValue([]);
    getLeaveRequestAccessInfoMock.mockResolvedValue({ id: "leave-1", requesterId: "marketer-9", status: LeaveStatus.REQUESTED });

    const result = await decideLeaveRequestAction(null, formData({ id: "leave-1", action: "approve" }));

    expectFail(result, ErrorCode.FORBIDDEN);
    expect(decideLeaveRequestMock).not.toHaveBeenCalled();
  });

  it("forbids a marketer from approving any request", async () => {
    const { decideLeaveRequestAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
    getLeaveRequestAccessInfoMock.mockResolvedValue({ id: "leave-1", requesterId: "marketer-1", status: LeaveStatus.REQUESTED });

    const result = await decideLeaveRequestAction(null, formData({ id: "leave-1", action: "approve" }));

    expectFail(result, ErrorCode.FORBIDDEN);
  });

  it("lets a requester cancel their own request", async () => {
    const { decideLeaveRequestAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
    getLeaveRequestAccessInfoMock.mockResolvedValue({ id: "leave-1", requesterId: "marketer-1", status: LeaveStatus.REQUESTED });
    decideLeaveRequestMock.mockResolvedValue({ id: "leave-1", status: LeaveStatus.CANCELED });

    const result = await decideLeaveRequestAction(null, formData({ id: "leave-1", action: "cancel" }));

    expect(expectOk(result)).toEqual({ id: "leave-1" });
    const [, data] = decideLeaveRequestMock.mock.calls[0];
    expect(data.status).toBe(LeaveStatus.CANCELED);
    expect(data.canceledAt).toBeInstanceOf(Date);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ action: "LEAVE_CANCELED" }));
  });

  it("rejects an invalid transition with a conflict", async () => {
    const { decideLeaveRequestAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(adminUser({ id: "admin-1" }));
    loadAccessScopesMock.mockResolvedValue([
      { adminId: "admin-1", marketerId: "marketer-1", clientId: null, allMarketers: false, allClients: false }
    ]);
    getLeaveRequestAccessInfoMock.mockResolvedValue({ id: "leave-1", requesterId: "marketer-1", status: LeaveStatus.APPROVED });

    const result = await decideLeaveRequestAction(null, formData({ id: "leave-1", action: "approve" }));

    expectFail(result, ErrorCode.CONFLICT);
    expect(decideLeaveRequestMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a missing request", async () => {
    const { decideLeaveRequestAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(adminUser());
    getLeaveRequestAccessInfoMock.mockResolvedValue(null);

    const result = await decideLeaveRequestAction(null, formData({ id: "missing", action: "approve" }));

    expectFail(result, ErrorCode.NOT_FOUND);
  });
});
