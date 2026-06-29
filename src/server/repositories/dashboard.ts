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

type ClientWhere =
  | Record<string, never>
  | { id: { in: string[] } }
  | { OR: Array<{ id: { in: string[] } } | { assignedMarketerId: { in: string[] } | { not: null } }> };

function hasRecords(values: string[]) {
  return values.length > 0;
}

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function buildAdminClientWhere(scopes: AdminScope[]): ClientWhere {
  if (scopes.some((scope) => scope.allClients)) {
    return {};
  }

  const clientIds = unique(scopes.map((scope) => scope.clientId));
  const marketerIds = unique(scopes.map((scope) => scope.marketerId));
  const allMarketers = scopes.some((scope) => scope.allMarketers);
  const clauses = [];

  if (hasRecords(clientIds)) {
    clauses.push({ id: { in: clientIds } });
  }

  if (allMarketers) {
    clauses.push({ assignedMarketerId: { not: null } });
  } else if (hasRecords(marketerIds)) {
    clauses.push({ assignedMarketerId: { in: marketerIds } });
  }

  return clauses.length > 0 ? { OR: clauses } : { id: { in: [] } };
}

function buildAdminClientRecordWhere(scopes: AdminScope[]) {
  const clientWhere = buildAdminClientWhere(scopes);

  if ("OR" in clientWhere) {
    return {
      OR: clientWhere.OR.map((clause) =>
        "id" in clause ? { clientId: clause.id } : { client: { assignedMarketerId: clause.assignedMarketerId } }
      )
    };
  }

  if ("id" in clientWhere) {
    return { clientId: clientWhere.id };
  }

  return {};
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
  const clientRecordWhere = buildAdminClientRecordWhere(scopes);

  return {
    client: clientWhere,
    work: buildAdminWorkWhere(scopes),
    billing: clientRecordWhere,
    expense: clientRecordWhere,
    leave: buildAdminLeaveWhere(scopes)
  };
}

function getBusinessYear(today: string) {
  return Number.parseInt(today.slice(0, 4), 10);
}

function isDevPreviewUser(user: CurrentUser) {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_SESSION === "true" && user.id === "dev-user";
}

function emptyDashboardInput(context: DashboardQueryContext): DashboardInput {
  return {
    today: context.today,
    timeZone: context.timeZone,
    assignedClientCount: 0,
    leaveBalanceDays: 0,
    workItems: [],
    billings: [],
    expenses: [],
    leaveRequests: []
  };
}

export async function fetchDashboardInput(user: CurrentUser, context: DashboardQueryContext): Promise<DashboardInput> {
  let assignedClientCount;
  let workItems;
  let billings;
  let expenses;
  let leaveRequests;
  let leavePolicy;

  try {
    const where = await buildWhereForUser(user);
    [assignedClientCount, workItems, billings, expenses, leaveRequests, leavePolicy] = await Promise.all([
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
        where: { userId: user.id, year: getBusinessYear(context.today) },
        select: {
          annualDays: true,
          carryOverDays: true,
          usedDays: true
        }
      })
    ]);
  } catch (error) {
    if (isDevPreviewUser(user)) {
      return emptyDashboardInput(context);
    }

    throw error;
  }

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
