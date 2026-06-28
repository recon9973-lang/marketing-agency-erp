import type { DashboardInput } from "@/domain/dashboard";
import { Role } from "@/domain/types";
import type { CurrentUser } from "@/server/session";
import { db } from "@/server/db";

type DashboardQueryContext = {
  today: string;
  timeZone: string;
};

type AdminScope = {
  clientId: string | null;
  marketerId: string | null;
  allClients: boolean;
  allMarketers: boolean;
};

function hasRecords(values: string[]) {
  return values.length > 0;
}

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function buildAdminClientWhere(scopes: AdminScope[]) {
  if (scopes.some((scope) => scope.allClients)) {
    return {};
  }

  const clientIds = unique(scopes.map((scope) => scope.clientId));
  return hasRecords(clientIds) ? { clientId: { in: clientIds } } : { id: { in: [] } };
}

function buildAdminWorkWhere(scopes: AdminScope[]) {
  const allClients = scopes.some((scope) => scope.allClients);
  const allMarketers = scopes.some((scope) => scope.allMarketers);

  if (allClients && allMarketers) {
    return {};
  }

  const clauses = [];
  const clientIds = unique(scopes.map((scope) => scope.clientId));
  const marketerIds = unique(scopes.map((scope) => scope.marketerId));

  if (allClients) {
    clauses.push({});
  } else if (hasRecords(clientIds)) {
    clauses.push({ clientId: { in: clientIds } });
  }

  if (allMarketers) {
    clauses.push({});
  } else if (hasRecords(marketerIds)) {
    clauses.push({ ownerId: { in: marketerIds } });
  }

  return clauses.length > 0 ? { OR: clauses } : { id: { in: [] } };
}

function buildAdminLeaveWhere(scopes: AdminScope[]) {
  if (scopes.some((scope) => scope.allMarketers)) {
    return {};
  }

  const marketerIds = unique(scopes.map((scope) => scope.marketerId));
  return hasRecords(marketerIds) ? { requesterId: { in: marketerIds } } : { id: { in: [] } };
}

async function getAdminScopes(adminId: string): Promise<AdminScope[]> {
  return db.accessScope.findMany({
    where: { adminId },
    select: {
      clientId: true,
      marketerId: true,
      allClients: true,
      allMarketers: true
    }
  });
}

async function buildWhereForUser(user: CurrentUser) {
  if (user.role === Role.SUPER_ADMIN) {
    return {
      client: {},
      work: {},
      billing: {},
      expense: {},
      leave: {}
    };
  }

  if (user.role === Role.MARKETER) {
    return {
      client: { assignedMarketerId: user.id },
      work: { ownerId: user.id },
      billing: { client: { assignedMarketerId: user.id } },
      expense: { submittedById: user.id },
      leave: { requesterId: user.id }
    };
  }

  const scopes = await getAdminScopes(user.id);
  const clientWhere = buildAdminClientWhere(scopes);

  return {
    client: "clientId" in clientWhere ? { id: clientWhere.clientId } : clientWhere,
    work: buildAdminWorkWhere(scopes),
    billing: clientWhere,
    expense: "clientId" in clientWhere ? clientWhere : {},
    leave: buildAdminLeaveWhere(scopes)
  };
}

export async function fetchDashboardInput(user: CurrentUser, context: DashboardQueryContext): Promise<DashboardInput> {
  const where = await buildWhereForUser(user);
  const [assignedClientCount, workItems, billings, expenses, leaveRequests, leavePolicy] = await Promise.all([
    db.client.count({ where: where.client }),
    db.workItem.findMany({
      where: where.work,
      select: {
        status: true,
        dueDate: true,
        category: true,
        clientId: true
      }
    }),
    db.billingRecord.findMany({
      where: where.billing,
      select: {
        status: true,
        issuedAmount: true,
        paidAmount: true
      }
    }),
    db.expenseRecord.findMany({
      where: where.expense,
      select: {
        amount: true
      }
    }),
    db.leaveRequest.findMany({
      where: where.leave,
      select: {
        status: true
      }
    }),
    db.leavePolicy.findFirst({
      where: { userId: user.id },
      orderBy: { year: "desc" },
      select: {
        annualDays: true,
        carryOverDays: true,
        usedDays: true
      }
    })
  ]);

  const leaveBalanceDays = leavePolicy
    ? leavePolicy.annualDays.toNumber() + leavePolicy.carryOverDays.toNumber() - leavePolicy.usedDays.toNumber()
    : 0;

  return {
    today: context.today,
    timeZone: context.timeZone,
    assignedClientCount,
    leaveBalanceDays,
    workItems,
    billings,
    expenses,
    leaveRequests
  };
}
