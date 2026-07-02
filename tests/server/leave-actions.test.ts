import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeaveStatus, LeaveType } from "@/domain/types";
import { ErrorCodes } from "@/server/errors";
import { cancelLeave, decideLeave, requestLeave } from "@/server/actions/leave";
import { expectFail, expectOk } from "../helpers/action-result";
import { makeAdmin, makeMarketer, makeScope, makeSuperAdmin } from "../helpers/fixtures";

const {
  getCurrentUserMock,
  leaveRequestFindUniqueMock,
  leaveRequestFindManyMock,
  leaveRequestCreateMock,
  leaveRequestUpdateMock,
  leavePolicyFindUniqueMock,
  accessScopeFindManyMock,
  auditLogCreateMock,
  revalidatePathMock
} = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  leaveRequestFindUniqueMock: vi.fn(),
  leaveRequestFindManyMock: vi.fn(),
  leaveRequestCreateMock: vi.fn(),
  leaveRequestUpdateMock: vi.fn(),
  leavePolicyFindUniqueMock: vi.fn(),
  accessScopeFindManyMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  revalidatePathMock: vi.fn()
}));

vi.mock("@/server/session", () => ({
  getCurrentUser: getCurrentUserMock
}));

vi.mock("@/server/db", () => ({
  db: {
    leaveRequest: {
      findUnique: leaveRequestFindUniqueMock,
      findMany: leaveRequestFindManyMock,
      create: leaveRequestCreateMock,
      update: leaveRequestUpdateMock
    },
    leavePolicy: { findUnique: leavePolicyFindUniqueMock },
    accessScope: { findMany: accessScopeFindManyMock },
    auditLog: { create: auditLogCreateMock }
  }
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));

const validInput = {
  type: LeaveType.ANNUAL,
  startDate: "2026-08-10",
  endDate: "2026-08-11",
  daysRequested: "2",
  reason: "가족 여행"
};

const storedRequest = {
  id: "leave-1",
  requesterId: "marketer-1",
  type: LeaveType.ANNUAL,
  status: LeaveStatus.REQUESTED,
  startDate: new Date("2026-08-10T00:00:00.000Z"),
  endDate: new Date("2026-08-11T00:00:00.000Z"),
  daysRequested: 2,
  reason: "가족 여행"
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue(makeMarketer());
  leaveRequestFindUniqueMock.mockResolvedValue(storedRequest);
  leaveRequestFindManyMock.mockResolvedValue([]);
  leaveRequestCreateMock.mockResolvedValue(storedRequest);
  leaveRequestUpdateMock.mockResolvedValue(storedRequest);
  leavePolicyFindUniqueMock.mockResolvedValue(null);
  accessScopeFindManyMock.mockResolvedValue([]);
  auditLogCreateMock.mockResolvedValue({});
});

describe("requestLeave", () => {
  it("returns field errors for invalid input", async () => {
    const result = await requestLeave({
      type: "VACATION",
      startDate: "2026-08-10",
      endDate: "2026-08-11",
      daysRequested: "1.3"
    });

    const error = expectFail(result, ErrorCodes.VALIDATION_ERROR);
    expect(error.fieldErrors?.type).toEqual(["허용되지 않는 휴가 유형입니다."]);
    expect(error.fieldErrors?.daysRequested).toEqual(["신청 일수는 0.5일 단위로 입력해주세요."]);
    expect(leaveRequestCreateMock).not.toHaveBeenCalled();
  });

  it("rejects ranges where the end precedes the start", async () => {
    const result = await requestLeave({ ...validInput, startDate: "2026-08-11", endDate: "2026-08-10" });

    const error = expectFail(result, ErrorCodes.VALIDATION_ERROR);
    expect(error.fieldErrors?.endDate).toEqual(["종료일은 시작일보다 빠를 수 없습니다."]);
    expect(leaveRequestCreateMock).not.toHaveBeenCalled();
  });

  it("rejects requests that exceed the remaining balance", async () => {
    leavePolicyFindUniqueMock.mockResolvedValue({ annualDays: 15, carryOverDays: 0 });
    leaveRequestFindManyMock.mockResolvedValue([
      { daysRequested: { toNumber: () => 14 }, status: LeaveStatus.APPROVED }
    ]);

    const error = expectFail(await requestLeave(validInput), ErrorCodes.VALIDATION_ERROR);
    expect(error.fieldErrors?.daysRequested).toEqual(["잔여 연차(1일)를 초과해 신청할 수 없습니다."]);
    expect(leaveRequestCreateMock).not.toHaveBeenCalled();
  });

  it("allows requests when no policy exists for the year", async () => {
    leavePolicyFindUniqueMock.mockResolvedValue(null);

    expectOk(await requestLeave(validInput));
    expect(leaveRequestCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requesterId: "marketer-1",
        status: LeaveStatus.REQUESTED,
        daysRequested: 2,
        startDate: new Date("2026-08-10T00:00:00.000Z")
      })
    });
  });

  it("links the year policy, writes an audit log, and revalidates", async () => {
    leavePolicyFindUniqueMock.mockResolvedValue({ id: "policy-1", annualDays: 15, carryOverDays: 2 });

    expectOk(await requestLeave(validInput));

    expect(leaveRequestCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ leavePolicyId: "policy-1" })
    });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "LEAVE_REQUESTED",
        targetType: "LeaveRequest",
        targetId: "leave-1"
      })
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/leave");
  });
});

describe("decideLeave", () => {
  it("rejects marketers", async () => {
    getCurrentUserMock.mockResolvedValue(makeMarketer());

    expectFail(await decideLeave("leave-1", { action: "approve" }), ErrorCodes.FORBIDDEN);
    expect(leaveRequestUpdateMock).not.toHaveBeenCalled();
  });

  it("blocks deciding your own request", async () => {
    getCurrentUserMock.mockResolvedValue(makeAdmin({ id: "marketer-1" }));
    accessScopeFindManyMock.mockResolvedValue([makeScope({ adminId: "marketer-1", allMarketers: true })]);

    const error = expectFail(await decideLeave("leave-1", { action: "approve" }), ErrorCodes.FORBIDDEN);
    expect(error.message).toBe("본인 휴가 신청은 직접 처리할 수 없습니다.");
  });

  it("blocks admins outside their marketer scope", async () => {
    getCurrentUserMock.mockResolvedValue(makeAdmin());
    accessScopeFindManyMock.mockResolvedValue([makeScope({ marketerId: "marketer-9" })]);

    expectFail(await decideLeave("leave-1", { action: "approve" }), ErrorCodes.FORBIDDEN);
  });

  it("approves requested leave with approver, reviewedAt and audit log", async () => {
    getCurrentUserMock.mockResolvedValue(makeSuperAdmin());
    leaveRequestUpdateMock.mockResolvedValue({ ...storedRequest, status: LeaveStatus.APPROVED });

    const result = await decideLeave("leave-1", { action: "approve", approvalNotes: "일정 확인 완료" });

    expect(expectOk(result)).toEqual({ id: "leave-1", status: LeaveStatus.APPROVED });
    expect(leaveRequestUpdateMock).toHaveBeenCalledWith({
      where: { id: "leave-1" },
      data: expect.objectContaining({
        status: LeaveStatus.APPROVED,
        approverId: "super-admin-1",
        reviewedAt: expect.any(Date),
        approvalNotes: "일정 확인 완료"
      })
    });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "LEAVE_APPROVED",
        beforeState: { status: LeaveStatus.REQUESTED },
        afterState: expect.objectContaining({ status: LeaveStatus.APPROVED })
      })
    });
  });

  it("rejects requested leave with a LEAVE_REJECTED audit action", async () => {
    getCurrentUserMock.mockResolvedValue(makeSuperAdmin());
    leaveRequestUpdateMock.mockResolvedValue({ ...storedRequest, status: LeaveStatus.REJECTED });

    const result = await decideLeave("leave-1", { action: "reject" });

    expect(expectOk(result)).toEqual({ id: "leave-1", status: LeaveStatus.REJECTED });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "LEAVE_REJECTED" })
    });
  });

  it("cannot decide an already processed request", async () => {
    getCurrentUserMock.mockResolvedValue(makeSuperAdmin());
    leaveRequestFindUniqueMock.mockResolvedValue({ ...storedRequest, status: LeaveStatus.APPROVED });

    expectFail(await decideLeave("leave-1", { action: "approve" }), ErrorCodes.VALIDATION_ERROR);
    expect(leaveRequestUpdateMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for missing requests", async () => {
    getCurrentUserMock.mockResolvedValue(makeSuperAdmin());
    leaveRequestFindUniqueMock.mockResolvedValue(null);

    expectFail(await decideLeave("missing", { action: "approve" }), ErrorCodes.NOT_FOUND);
  });
});

describe("cancelLeave", () => {
  it("only allows the requester to cancel", async () => {
    getCurrentUserMock.mockResolvedValue(makeMarketer({ id: "marketer-2" }));

    expectFail(await cancelLeave("leave-1"), ErrorCodes.FORBIDDEN);
  });

  it("cancels a requested leave with canceledAt and audit log", async () => {
    leaveRequestUpdateMock.mockResolvedValue({ ...storedRequest, status: LeaveStatus.CANCELED });

    const result = await cancelLeave("leave-1");

    expect(expectOk(result)).toEqual({ id: "leave-1", status: LeaveStatus.CANCELED });
    expect(leaveRequestUpdateMock).toHaveBeenCalledWith({
      where: { id: "leave-1" },
      data: expect.objectContaining({ status: LeaveStatus.CANCELED, canceledAt: expect.any(Date) })
    });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "LEAVE_CANCELED" })
    });
  });

  it("cannot cancel rejected or already canceled requests", async () => {
    leaveRequestFindUniqueMock.mockResolvedValue({ ...storedRequest, status: LeaveStatus.REJECTED });

    expectFail(await cancelLeave("leave-1"), ErrorCodes.VALIDATION_ERROR);
  });
});
