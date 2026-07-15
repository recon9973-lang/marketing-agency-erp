import type { Prisma } from "@prisma/client";
import { Role } from "@/domain/types";
import { assertCanAccessClient } from "@/domain/access-control";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

export type ContractListItem = {
  id: string;
  title: string;
  clientName: string;
  authorName: string;
  status: string;
  amount: string | null;
  startDate: Date | null;
  endDate: Date | null;
  signerName: string | null;
  signedAt: Date | null;
  updatedAt: Date;
};

export type ContractProductRow = {
  id: string;
  productId: string;
  name: string;
  category: string;
  monthlyFee: number | null;
  adBudget: number | null;
  quantity: number;
  notes: string | null;
};

export type ContractDetail = {
  id: string;
  clientId: string;
  clientName: string;
  authorName: string;
  title: string;
  body: string;
  details: unknown; // 구조화 계약 항목(JSON) — parseContractDetails로 해석
  signToken: string | null;
  amount: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  signerName: string | null;
  signerTitle: string | null;
  signatureData: string | null;
  signedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  products: ContractProductRow[];
  productMonthlyTotal: number; // 상품 월 대행료 합계(수량 반영)
  productAdBudgetTotal: number; // 상품 월 광고비 합계(수량 반영)
};

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

async function buildContractWhere(user: CurrentUser): Promise<Prisma.ContractWhereInput> {
  if (user.role === Role.SUPER_ADMIN) return {};
  if (user.role === Role.MARKETER) {
    return { OR: [{ authorId: user.id }, { client: { assignedMarketerId: user.id } }] };
  }
  // ADMIN: AccessScope 기반
  const scopes = await db.accessScope.findMany({
    where: { adminId: user.id },
    select: { clientId: true, marketerId: true, allClients: true, allMarketers: true }
  });
  if (scopes.some((s) => s.allClients)) return {};
  const clientIds = unique(scopes.map((s) => s.clientId));
  const marketerIds = unique(scopes.map((s) => s.marketerId));
  const allMarketers = scopes.some((s) => s.allMarketers);
  const clauses: Prisma.ContractWhereInput[] = [];
  if (clientIds.length > 0) clauses.push({ clientId: { in: clientIds } });
  if (allMarketers) clauses.push({ client: { assignedMarketerId: { not: null } } });
  else if (marketerIds.length > 0) clauses.push({ client: { assignedMarketerId: { in: marketerIds } } });
  return clauses.length > 0 ? { OR: clauses } : { id: { in: [] } };
}

export async function fetchContractsForUser(user: CurrentUser): Promise<ContractListItem[]> {
  const rows = await db.contract.findMany({
    where: await buildContractWhere(user),
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      amount: true,
      startDate: true,
      endDate: true,
      signerName: true,
      signedAt: true,
      updatedAt: true,
      client: { select: { name: true } },
      author: { select: { name: true } }
    }
  });
  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    clientName: c.client.name,
    authorName: c.author.name,
    status: c.status,
    amount: c.amount ? c.amount.toString() : null,
    startDate: c.startDate,
    endDate: c.endDate,
    signerName: c.signerName,
    signedAt: c.signedAt,
    updatedAt: c.updatedAt
  }));
}

export type ContractForSign = {
  id: string;
  title: string;
  clientName: string;
  amount: string | null;
  startDate: Date | null;
  endDate: Date | null;
  details: unknown;
  status: string;
  signerName: string | null;
  signatureData: string | null;
  signedAt: Date | null;
};

/** 원격 서명 페이지용 — signToken으로 조회(인증 불필요). 없으면 null. */
export async function getContractForSigning(token: string): Promise<ContractForSign | null> {
  if (!token || token.length < 16) return null;
  const c = await db.contract.findUnique({
    where: { signToken: token },
    include: { client: { select: { name: true } } }
  });
  if (!c) return null;
  return {
    id: c.id,
    title: c.title,
    clientName: c.client.name,
    amount: c.amount ? c.amount.toString() : null,
    startDate: c.startDate,
    endDate: c.endDate,
    details: c.details,
    status: c.status,
    signerName: c.signerName,
    signatureData: c.signatureData,
    signedAt: c.signedAt
  };
}

export async function getContractDetail(user: CurrentUser, id: string): Promise<ContractDetail | null> {
  const c = await db.contract.findUnique({
    where: { id },
    include: {
      client: { select: { name: true, assignedMarketerId: true } },
      author: { select: { name: true } },
      products: {
        orderBy: { createdAt: "asc" },
        include: { product: { select: { name: true, category: true } } }
      }
    }
  });
  if (!c) return null;
  // 접근 권한 검증 (거래처 스코프). 권한 없으면 throw → 상위에서 notFound 처리.
  const scopes =
    user.role === Role.ADMIN
      ? await db.accessScope.findMany({
          where: { adminId: user.id },
          select: { adminId: true, marketerId: true, clientId: true, allMarketers: true, allClients: true }
        })
      : [];
  try {
    assertCanAccessClient(user, c.clientId, scopes, c.client.assignedMarketerId);
  } catch {
    return null;
  }
  const products: ContractProductRow[] = c.products.map((p) => ({
    id: p.id,
    productId: p.productId,
    name: p.product.name,
    category: p.product.category,
    monthlyFee: p.monthlyFee ? Number(p.monthlyFee) : null,
    adBudget: p.adBudget ? Number(p.adBudget) : null,
    quantity: p.quantity,
    notes: p.notes
  }));
  const productMonthlyTotal = products.reduce((s, p) => s + (p.monthlyFee ?? 0) * p.quantity, 0);
  const productAdBudgetTotal = products.reduce((s, p) => s + (p.adBudget ?? 0) * p.quantity, 0);

  return {
    id: c.id,
    clientId: c.clientId,
    clientName: c.client.name,
    authorName: c.author.name,
    title: c.title,
    body: c.body,
    details: c.details,
    signToken: c.signToken,
    amount: c.amount ? c.amount.toString() : null,
    startDate: c.startDate,
    endDate: c.endDate,
    status: c.status,
    signerName: c.signerName,
    signerTitle: c.signerTitle,
    signatureData: c.signatureData,
    signedAt: c.signedAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    products,
    productMonthlyTotal,
    productAdBudgetTotal
  };
}
