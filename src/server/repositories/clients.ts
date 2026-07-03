import { canAccessClient, type AccessScopeRecord, type CurrentUser } from "@/domain/access-control";
import { Role } from "@/domain/types";
import { db } from "@/server/db";

export type ClientListItem = {
  id: string;
  name: string;
  assignedMarketerId: string | null;
  assignedMarketerName?: string | null;
  monthlyContractFee?: string | number | null;
  active?: boolean;
  latestWorkStatus?: string | null;
  latestBillingStatus?: string | null;
};

export function filterClientsForUser(
  user: CurrentUser,
  clients: ClientListItem[],
  scopes: AccessScopeRecord[]
) {
  return clients.filter((client) => canAccessClient(user, client.id, scopes, client.assignedMarketerId));
}

function buildClientWhere(user: CurrentUser, scopes: AccessScopeRecord[]) {
  if (user.role === Role.SUPER_ADMIN) {
    return {};
  }

  if (user.role === Role.MARKETER) {
    return { assignedMarketerId: user.id };
  }

  if (scopes.some((scope) => scope.adminId === user.id && scope.allClients)) {
    return {};
  }

  const clientIds = scopes
    .filter((scope) => scope.adminId === user.id)
    .map((scope) => scope.clientId)
    .filter((clientId): clientId is string => Boolean(clientId));
  const marketerIds = scopes
    .filter((scope) => scope.adminId === user.id)
    .map((scope) => scope.marketerId)
    .filter((marketerId): marketerId is string => Boolean(marketerId));
  const hasAllMarketers = scopes.some((scope) => scope.adminId === user.id && scope.allMarketers);

  const clauses = [];

  if (clientIds.length > 0) {
    clauses.push({ id: { in: [...new Set(clientIds)] } });
  }

  if (hasAllMarketers) {
    clauses.push({ assignedMarketerId: { not: null } });
  } else if (marketerIds.length > 0) {
    clauses.push({ assignedMarketerId: { in: [...new Set(marketerIds)] } });
  }

  return clauses.length > 0 ? { OR: clauses } : { id: { in: [] } };
}

export async function fetchClientsForUser(user: CurrentUser): Promise<ClientListItem[]> {
  const scopes =
    user.role === Role.ADMIN
      ? await db.accessScope.findMany({
          where: { adminId: user.id },
          select: {
            adminId: true,
            marketerId: true,
            clientId: true,
            allMarketers: true,
            allClients: true
          }
        })
      : [];

  const clients = await db.client.findMany({
    where: buildClientWhere(user, scopes),
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      assignedMarketerId: true,
      monthlyContractFee: true,
      active: true,
      assignedMarketer: {
        select: {
          name: true
        }
      },
      workItems: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { status: true }
      },
      billingRecords: {
        orderBy: { billingMonth: "desc" },
        take: 1,
        select: { status: true }
      }
    }
  });

  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    assignedMarketerId: client.assignedMarketerId,
    assignedMarketerName: client.assignedMarketer?.name ?? null,
    monthlyContractFee: client.monthlyContractFee?.toString() ?? null,
    active: client.active,
    latestWorkStatus: client.workItems[0]?.status ?? null,
    latestBillingStatus: client.billingRecords[0]?.status ?? null
  }));
}

/** 역할별 거래처 where 조건 (읽기 스코프). ADMIN은 AccessScope 반영. */
async function clientScopeWhere(user: CurrentUser) {
  if (user.role === Role.SUPER_ADMIN) return {};
  if (user.role === Role.MARKETER) return { assignedMarketerId: user.id };
  // ADMIN: allClients | 지정 clientId | 지정/전체 marketer
  const scopes = await db.accessScope.findMany({ where: { adminId: user.id } });
  if (scopes.some((s) => s.allClients || s.allMarketers)) return {};
  const clientIds = scopes.map((s) => s.clientId).filter(Boolean) as string[];
  const marketerIds = scopes.map((s) => s.marketerId).filter(Boolean) as string[];
  return { OR: [{ id: { in: clientIds } }, { assignedMarketerId: { in: marketerIds } }] };
}

export async function listClientsForUser(user: CurrentUser) {
  const where = await clientScopeWhere(user);
  const clients = await db.client.findMany({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true, name: true, code: true, active: true, assignedMarketerId: true,
      industryCategory: { select: { name: true, colorTag: true, parent: { select: { name: true, colorTag: true } } } },
      assignedMarketer: { select: { name: true } },
      billingRecords: { where: { status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } }, select: { id: true }, take: 1 }
    }
  });
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    active: c.active,
    // 하위(진료과)면 그 이름/색, 아니면 대분류
    industryName: c.industryCategory?.name ?? c.industryCategory?.parent?.name ?? null,
    industryColor: c.industryCategory?.colorTag ?? c.industryCategory?.parent?.colorTag ?? null,
    assignedMarketerName: c.assignedMarketer?.name ?? null,
    outstanding: c.billingRecords.length > 0
  }));
}
