import { calculateRemainingLeave, type LeaveRequestFormInput } from "@/domain/leave";
import { LeaveStatus, LeaveType, Role } from "@/domain/types";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

type AdminScope = {
  marketerId: string | null;
  allMarketers: boolean;
};

export type LeaveRequestListItem = {
  id: string;
  requesterName: string;
  type: LeaveType;
  status: LeaveStatus;
  startDate: Date;
  endDate: Date;
  daysRequested: number;
  reason: string | null;
};

export type LeaveOverview = {
  allowanceDays: number;
  remainingDays: number;
  requests: LeaveRequestListItem[];
  approvalRequests: LeaveRequestListItem[];
};

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function buildApprovalWhereForAdmin(scopes: AdminScope[]) {
  if (scopes.some((scope) => scope.allMarketers)) {
    return {};
  }

  const marketerIds = unique(scopes.map((scope) => scope.marketerId));
  return marketerIds.length > 0 ? { requesterId: { in: marketerIds } } : { id: { in: [] } };
}

async function buildApprovalWhere(user: CurrentUser) {
  if (user.role === Role.SUPER_ADMIN) {
    return {};
  }

  if (user.role === Role.MARKETER) {
    return { requesterId: user.id };
  }

  const scopes = await db.accessScope.findMany({
    where: { adminId: user.id },
    select: {
      marketerId: true,
      allMarketers: true
    }
  });

  return buildApprovalWhereForAdmin(scopes);
}

function mapLeaveRequest(request: {
  id: string;
  type: LeaveType;
  status: LeaveStatus;
  startDate: Date;
  endDate: Date;
  daysRequested: { toNumber(): number };
  reason: string | null;
  requester: { name: string };
}): LeaveRequestListItem {
  return {
    id: request.id,
    requesterName: request.requester.name,
    type: request.type,
    status: request.status,
    startDate: request.startDate,
    endDate: request.endDate,
    daysRequested: request.daysRequested.toNumber(),
    reason: request.reason
  };
}

export async function fetchLeaveOverviewForUser(user: CurrentUser, year = new Date().getFullYear()): Promise<LeaveOverview> {
  const [policy, ownRequests, approvalRequests] = await Promise.all([
    db.leavePolicy.findUnique({
      where: { userId_year: { userId: user.id, year } },
      select: {
        annualDays: true,
        carryOverDays: true
      }
    }),
    db.leaveRequest.findMany({
      where: { requesterId: user.id },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        daysRequested: true,
        reason: true,
        requester: {
          select: { name: true }
        }
      }
    }),
    db.leaveRequest.findMany({
      where: {
        AND: [await buildApprovalWhere(user), { status: LeaveStatus.REQUESTED }]
      },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        daysRequested: true,
        reason: true,
        requester: {
          select: { name: true }
        }
      }
    })
  ]);

  const allowanceDays = policy ? policy.annualDays.toNumber() + policy.carryOverDays.toNumber() : 0;
  const requests = ownRequests.map(mapLeaveRequest);

  return {
    allowanceDays,
    remainingDays: calculateRemainingLeave(
      allowanceDays,
      requests.map((request) => ({ days: request.daysRequested, status: request.status }))
    ),
    requests,
    approvalRequests: user.role === Role.MARKETER ? [] : approvalRequests.map(mapLeaveRequest)
  };
}

export type LeaveRequestAccessInfo = {
  id: string;
  requesterId: string;
  status: LeaveStatus;
};

export async function getLeaveRequestAccessInfo(leaveRequestId: string): Promise<LeaveRequestAccessInfo | null> {
  return db.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    select: { id: true, requesterId: true, status: true }
  });
}

export async function createLeaveRequest(
  input: LeaveRequestFormInput,
  requesterId: string
): Promise<{ id: string }> {
  return db.leaveRequest.create({
    data: {
      requesterId,
      type: input.type,
      startDate: new Date(`${input.startDate}T00:00:00.000Z`),
      endDate: new Date(`${input.endDate}T00:00:00.000Z`),
      daysRequested: input.daysRequested,
      reason: input.reason ?? null
    },
    select: { id: true }
  });
}

export type LeaveDecisionData = {
  status: LeaveStatus;
  approverId?: string;
  reviewedAt?: Date;
  canceledAt?: Date;
  approvalNotes?: string | null;
};

export async function decideLeaveRequest(
  leaveRequestId: string,
  data: LeaveDecisionData
): Promise<{ id: string; status: LeaveStatus }> {
  return db.leaveRequest.update({
    where: { id: leaveRequestId },
    data,
    select: { id: true, status: true }
  });
}
