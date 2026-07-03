import { isWorkDelayed } from "@/domain/work";
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

/** 마케터=본인 업무, 그 외=거래처 스코프(단순화: 여기선 owner/거래처 기준). */
function workScopeWhere(user: CurrentUser) {
  if (user.role === Role.MARKETER) return { ownerId: user.id };
  return {}; // SUPER_ADMIN 전체 / ADMIN은 상위에서 clientId 필터와 결합 권장
}

/** 담당자 일간 스케줄러 데이터: 그 날 예정된 업무 + 미배치(마감만 있는) 업무. */
export async function getSchedulerDay(user: CurrentUser, ownerId: string, day: Date) {
  const start = new Date(day); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);

  const items = await db.workItem.findMany({
    where: {
      ownerId,
      status: { not: "COMPLETED" },
      OR: [
        { scheduledStart: { gte: start, lt: end } },
        { scheduledStart: null, dueDate: { not: null } } // 미배치 트레이 후보
      ]
    },
    orderBy: [{ scheduledStart: "asc" }, { sequence: "asc" }],
    select: { id: true, title: true, scheduledStart: true, scheduledEnd: true, estimatedMinutes: true }
  });
  return items.map((i) => ({
    id: i.id,
    title: i.title,
    scheduledStart: i.scheduledStart?.toISOString() ?? null,
    scheduledEnd: i.scheduledEnd?.toISOString() ?? null,
    estimatedMinutes: i.estimatedMinutes
  }));
}

/** 부모-자식 트리(세분화) 목록. */
export async function listWorkTree(user: CurrentUser, clientId?: string) {
  const scope = workScopeWhere(user);
  const parents = await db.workItem.findMany({
    where: { ...scope, parentId: null, ...(clientId ? { clientId } : {}) },
    orderBy: [{ dueDate: "asc" }],
    select: {
      id: true, title: true, status: true, dueDate: true, category: true,
      subtasks: { orderBy: { sequence: "asc" }, select: { id: true, title: true, status: true, dueDate: true, ownerId: true } }
    }
  });
  return parents;
}
