import { isWorkDelayed, type WorkFormInput } from "@/domain/work";
import { Role, WorkCategory, WorkStatus } from "@/domain/types";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

type AdminScope = {
  clientId: string | null;
  marketerId: string | null;
  allClients: boolean;
  allMarketers: boolean;
};

export type WorkListFilters = {
  category?: WorkCategory;
  status?: WorkStatus;
  clientId?: string;
  ownerId?: string;
  dueDate?: string;
};

export type WorkListItem = {
  id: string;
  title: string;
  clientName: string;
  ownerName: string;
  category: WorkCategory;
  status: WorkStatus;
  priority: number;
  dueDate: Date | string | null;
  progressNotes: string | null;
  delayed: boolean;
};

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
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
  } else if (clientIds.length > 0) {
    clauses.push({ clientId: { in: clientIds } });
  }

  if (allMarketers) {
    clauses.push({});
  } else if (marketerIds.length > 0) {
    clauses.push({ ownerId: { in: marketerIds } });
  }

  return clauses.length > 0 ? { OR: clauses } : { id: { in: [] } };
}

function buildFilterWhere(filters: WorkListFilters) {
  const where: Record<string, unknown> = {};

  if (filters.category) {
    where.category = filters.category;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.clientId) {
    where.clientId = filters.clientId;
  }

  if (filters.ownerId) {
    where.ownerId = filters.ownerId;
  }

  if (filters.dueDate) {
    const start = new Date(`${filters.dueDate}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    where.dueDate = { gte: start, lt: end };
  }

  return where;
}

function hasWhereValues(where: Record<string, unknown>) {
  return Object.keys(where).length > 0;
}

function mergeWhere(scopeWhere: Record<string, unknown>, filterWhere: Record<string, unknown>) {
  if (hasWhereValues(scopeWhere) && hasWhereValues(filterWhere)) {
    return { AND: [scopeWhere, filterWhere] };
  }

  return hasWhereValues(filterWhere) ? filterWhere : scopeWhere;
}

async function buildScopeWhere(user: CurrentUser) {
  if (user.role === Role.SUPER_ADMIN) {
    return {};
  }

  if (user.role === Role.MARKETER) {
    return { ownerId: user.id };
  }

  const scopes = await db.accessScope.findMany({
    where: { adminId: user.id },
    select: {
      clientId: true,
      marketerId: true,
      allClients: true,
      allMarketers: true
    }
  });

  return buildAdminWorkWhere(scopes);
}

export async function fetchWorkItemsForUser(
  user: CurrentUser,
  filters: WorkListFilters = {},
  today = new Date()
): Promise<WorkListItem[]> {
  const scopeWhere = await buildScopeWhere(user);
  const filterWhere = buildFilterWhere(filters);
  const workItems = await db.workItem.findMany({
    where: mergeWhere(scopeWhere, filterWhere),
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      priority: true,
      dueDate: true,
      progressNotes: true,
      client: {
        select: { name: true }
      },
      owner: {
        select: { name: true }
      }
    }
  });

  return workItems.map((item) => ({
    id: item.id,
    title: item.title,
    clientName: item.client.name,
    ownerName: item.owner.name,
    category: item.category,
    status: item.status,
    priority: item.priority,
    dueDate: item.dueDate,
    progressNotes: item.progressNotes,
    delayed: isWorkDelayed(item, today)
  }));
}

export type WorkItemDetail = {
  id: string;
  clientId: string;
  ownerId: string;
  title: string;
  category: WorkCategory;
  status: WorkStatus;
  priority: number;
  dueDate: string | null;
  progressNotes: string | null;
  resultSummary: string | null;
};

/** 거래처/소유자 접근 판정에 필요한 최소 정보. */
export type WorkItemAccessInfo = {
  id: string;
  clientId: string;
  ownerId: string;
  status: WorkStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  clientAssignedMarketerId: string | null;
};

function workDateOnly(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toWorkData(input: WorkFormInput) {
  return {
    clientId: input.clientId,
    ownerId: input.ownerId,
    title: input.title,
    category: input.category,
    priority: input.priority,
    dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
    progressNotes: input.progressNotes ?? null,
    resultSummary: input.resultSummary ?? null
  };
}

export async function getWorkItemDetail(workItemId: string): Promise<WorkItemDetail | null> {
  const item = await db.workItem.findUnique({
    where: { id: workItemId },
    select: {
      id: true,
      clientId: true,
      ownerId: true,
      title: true,
      category: true,
      status: true,
      priority: true,
      dueDate: true,
      progressNotes: true,
      resultSummary: true
    }
  });

  if (!item) {
    return null;
  }

  return { ...item, dueDate: workDateOnly(item.dueDate) };
}

export async function getWorkItemAccessInfo(workItemId: string): Promise<WorkItemAccessInfo | null> {
  const item = await db.workItem.findUnique({
    where: { id: workItemId },
    select: {
      id: true,
      clientId: true,
      ownerId: true,
      status: true,
      startedAt: true,
      completedAt: true,
      client: { select: { assignedMarketerId: true } }
    }
  });

  if (!item) {
    return null;
  }

  return {
    id: item.id,
    clientId: item.clientId,
    ownerId: item.ownerId,
    status: item.status,
    startedAt: item.startedAt,
    completedAt: item.completedAt,
    clientAssignedMarketerId: item.client.assignedMarketerId
  };
}

export async function createWorkItem(input: WorkFormInput, createdById: string): Promise<{ id: string }> {
  return db.workItem.create({
    data: { ...toWorkData(input), createdById },
    select: { id: true }
  });
}

export async function updateWorkItem(workItemId: string, input: WorkFormInput): Promise<{ id: string }> {
  return db.workItem.update({
    where: { id: workItemId },
    data: toWorkData(input),
    select: { id: true }
  });
}

export async function changeWorkItemStatus(
  workItemId: string,
  nextStatus: WorkStatus,
  timestamps: { startedAt?: Date; completedAt?: Date }
): Promise<{ id: string; status: WorkStatus }> {
  return db.workItem.update({
    where: { id: workItemId },
    data: { status: nextStatus, ...timestamps },
    select: { id: true, status: true }
  });
}
