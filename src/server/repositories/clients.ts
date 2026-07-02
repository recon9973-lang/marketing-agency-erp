import { canAccessClient, type AccessScopeRecord, type CurrentUser } from "@/domain/access-control";
import { buildClientScopeWhere, fetchAccessScopes } from "@/server/authorization";
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

export async function fetchClientsForUser(user: CurrentUser): Promise<ClientListItem[]> {
  const scopes = await fetchAccessScopes(user);

  const clients = await db.client.findMany({
    where: buildClientScopeWhere(user, scopes),
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
