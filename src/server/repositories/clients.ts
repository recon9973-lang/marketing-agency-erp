import { canAccessClient, type AccessScopeRecord, type CurrentUser } from "@/domain/access-control";
import type { ClientFormInput } from "@/domain/clients";
import { Role } from "@/domain/types";
import { db } from "@/server/db";
import { buildAccessibleClientWhere, loadAccessScopes } from "@/server/scope";

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
  const scopes = await loadAccessScopes(user);

  const clients = await db.client.findMany({
    where: buildAccessibleClientWhere(user, scopes),
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

export type ClientDetail = {
  id: string;
  name: string;
  code: string;
  businessNumber: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  monthlyContractFee: string | null;
  serviceNotes: string | null;
  active: boolean;
  assignedMarketerId: string | null;
};

export type AssignableMarketer = {
  id: string;
  name: string;
};

function toDateOnly(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** 담당자 배정 드롭다운에 쓸 활성 담당자 목록. */
export async function fetchAssignableMarketers(): Promise<AssignableMarketer[]> {
  const marketers = await db.user.findMany({
    where: { role: Role.MARKETER, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });

  return marketers;
}

/** 수정 화면용 거래처 단건 조회. */
export async function getClientDetail(clientId: string): Promise<ClientDetail | null> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      code: true,
      businessNumber: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      contractStartDate: true,
      contractEndDate: true,
      monthlyContractFee: true,
      serviceNotes: true,
      active: true,
      assignedMarketerId: true
    }
  });

  if (!client) {
    return null;
  }

  return {
    id: client.id,
    name: client.name,
    code: client.code,
    businessNumber: client.businessNumber,
    contactName: client.contactName,
    contactEmail: client.contactEmail,
    contactPhone: client.contactPhone,
    contractStartDate: toDateOnly(client.contractStartDate),
    contractEndDate: toDateOnly(client.contractEndDate),
    monthlyContractFee: client.monthlyContractFee?.toString() ?? null,
    serviceNotes: client.serviceNotes,
    active: client.active,
    assignedMarketerId: client.assignedMarketerId
  };
}

/** 거래처 식별을 위한 담당자 id + 존재 여부 조회. */
export async function getClientAccessInfo(clientId: string) {
  return db.client.findUnique({
    where: { id: clientId },
    select: { id: true, assignedMarketerId: true }
  });
}

function toPrismaData(input: ClientFormInput) {
  return {
    name: input.name,
    code: input.code,
    businessNumber: input.businessNumber ?? null,
    contactName: input.contactName ?? null,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
    contractStartDate: input.contractStartDate ? new Date(`${input.contractStartDate}T00:00:00.000Z`) : null,
    contractEndDate: input.contractEndDate ? new Date(`${input.contractEndDate}T00:00:00.000Z`) : null,
    monthlyContractFee: input.monthlyContractFee ?? null,
    serviceNotes: input.serviceNotes ?? null,
    active: input.active,
    assignedMarketerId: input.assignedMarketerId ?? null
  };
}

export async function createClient(input: ClientFormInput): Promise<{ id: string }> {
  const created = await db.client.create({
    data: toPrismaData(input),
    select: { id: true }
  });

  return created;
}

export async function updateClient(clientId: string, input: ClientFormInput): Promise<{ id: string }> {
  const updated = await db.client.update({
    where: { id: clientId },
    data: toPrismaData(input),
    select: { id: true }
  });

  return updated;
}
