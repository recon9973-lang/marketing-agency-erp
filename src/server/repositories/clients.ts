import { canAccessClient, type AccessScopeRecord, type CurrentUser } from "@/domain/access-control";
import { Role } from "@/domain/types";
import { db } from "@/server/db";

/**
 * 운영 DB 스키마 자가치유(멱등·additive 전용) — 빌드 시 `prisma db push`/`sync-additive`가
 * 타임아웃·스킵되어 라이프사이클 단계 컬럼(stage/stageUpdatedAt)이나 업종 색상(colorTag)이
 * 누락되면 거래처 조회가 P2022로 전체 실패한다(거래처/의료법검수/회의록/결재/정산 동반 다운).
 * 컬럼이 없으면 읽기 직전에 보강한다. 인스턴스당 1회만 실행되도록 프로미스를 메모이즈.
 */
let clientSchemaEnsured: Promise<void> | null = null;
function ensureClientColumns() {
  if (!clientSchemaEnsured) {
    clientSchemaEnsured = (async () => {
      const stmts = [
        'ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "stage" TEXT NOT NULL DEFAULT \'ONBOARDING\'',
        'ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "stageUpdatedAt" TIMESTAMP(3)',
        'ALTER TABLE "IndustryCategory" ADD COLUMN IF NOT EXISTS "colorTag" TEXT'
      ];
      for (const sql of stmts) {
        try {
          await db.$executeRawUnsafe(sql);
        } catch (e) {
          console.warn("[clients] 컬럼 보장 실패(무시):", String(e).slice(0, 140));
        }
      }
    })().catch(() => {
      // 다음 호출에서 재시도할 수 있도록 실패 시 메모이즈 해제.
      clientSchemaEnsured = null;
    });
  }
  return clientSchemaEnsured;
}

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

export function buildClientWhere(user: CurrentUser, scopes: AccessScopeRecord[]) {
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
  await ensureClientColumns();
  const where = await clientScopeWhere(user);
  const clients = await db.client.findMany({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true, name: true, code: true, active: true, stage: true, stageUpdatedAt: true, createdAt: true, assignedMarketerId: true,
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
    stage: c.stage,
    // 현재 단계 진입 시각(SLA 기준). 전이 기록이 없으면 거래처 생성 시각으로 폴백.
    stageSince: (c.stageUpdatedAt ?? c.createdAt).toISOString(),
    // 하위(진료과)면 그 이름/색, 아니면 대분류
    industryName: c.industryCategory?.name ?? c.industryCategory?.parent?.name ?? null,
    industryColor: c.industryCategory?.colorTag ?? c.industryCategory?.parent?.colorTag ?? null,
    assignedMarketerName: c.assignedMarketer?.name ?? null,
    outstanding: c.billingRecords.length > 0
  }));
}

/**
 * 계약서 폼 인계용 거래처 목록 — 이미 아는 정보(사업자번호·대표자·주소·월광고비)를 함께 반환해
 * 계약 작성 시 재입력을 없앤다. 주소는 최신 컨설팅 보고서 → 지역 순으로 채운다.
 */
export async function listClientsForContractForm(user: CurrentUser) {
  await ensureClientColumns();
  const where = await clientScopeWhere(user);
  const clients = await db.client.findMany({
    where: { ...where, active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      businessNumber: true,
      contactName: true,
      region: true,
      monthlyContractFee: true,
      consultingReports: { orderBy: { createdAt: "desc" }, take: 1, select: { address: true } }
    }
  });
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    businessNumber: c.businessNumber ?? null,
    contactName: c.contactName ?? null,
    address: c.consultingReports[0]?.address ?? c.region ?? null,
    monthlyFee: c.monthlyContractFee != null ? Number(c.monthlyContractFee) : null
  }));
}

/** 거래처 상세 (권한 스코프 적용). 접근 불가/미존재 시 null → 페이지는 notFound 처리. */
export async function getClientDetail(user: CurrentUser, clientId: string) {
  await ensureClientColumns();
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      code: true,
      active: true,
      stage: true,
      stageUpdatedAt: true,
      createdAt: true,
      businessType: true,
      portalToken: true,
      assignedMarketerId: true,
      industryCategoryId: true,
      industryCustom: true,
      region: true,
      industryCategory: { select: { name: true, parent: { select: { name: true } } } },
      assignedMarketer: { select: { name: true } },
      accounts: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          label: true,
          platform: true,
          externalUrl: true,
          usernameEnc: true,
          passwordEnc: true,
          channelType: { select: { name: true } }
        }
      },
      workItems: {
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
        select: { id: true, title: true, status: true, dueDate: true }
      },
      billingRecords: {
        orderBy: { billingMonth: "desc" },
        select: { id: true, billingMonth: true, issuedAmount: true, paidAmount: true, status: true }
      },
      reports: {
        orderBy: { reportingMonth: "desc" },
        select: { id: true, title: true, reportingMonth: true, status: true, metrics: true }
      }
    }
  });
  if (!client) return null;

  const scopes =
    user.role === Role.ADMIN
      ? await db.accessScope.findMany({
          where: { adminId: user.id },
          select: { adminId: true, marketerId: true, clientId: true, allMarketers: true, allClients: true }
        })
      : [];
  if (!canAccessClient(user, client.id, scopes, client.assignedMarketerId)) return null;

  const ym = (d: Date) => d.toISOString().slice(0, 7);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  return {
    client: {
      id: client.id,
      name: client.name,
      code: client.code,
      active: client.active,
      stage: client.stage,
      stageUpdatedAt: client.stageUpdatedAt,
      createdAt: client.createdAt,
      businessType: client.businessType,
      portalToken: client.portalToken,
      industryName: client.industryCategory?.name ?? client.industryCategory?.parent?.name ?? null,
      assignedMarketerName: client.assignedMarketer?.name ?? null,
      assignedMarketerId: client.assignedMarketerId,
      industryCategoryId: client.industryCategoryId,
      industryCustom: client.industryCustom,
      region: client.region
    },
    channels: client.accounts.map((a) => ({
      id: a.id,
      label: a.label,
      channelName: a.channelType?.name ?? a.platform ?? "채널",
      externalUrl: a.externalUrl,
      hasCredentials: Boolean(a.usernameEnc || a.passwordEnc)
    })),
    works: client.workItems.map((w) => ({
      id: w.id,
      title: w.title,
      status: w.status,
      dueDate: w.dueDate ? ymd(w.dueDate) : null
    })),
    billings: client.billingRecords.map((b) => ({
      id: b.id,
      billingMonth: ym(b.billingMonth),
      issuedAmount: b.issuedAmount.toNumber(),
      paidAmount: b.paidAmount.toNumber(),
      status: b.status
    })),
    reports: client.reports.map((r) => ({
      id: r.id,
      title: r.title,
      reportingMonth: ym(r.reportingMonth),
      status: r.status,
      metrics: (r.metrics as Record<string, unknown> | null) ?? null
    }))
  };
}

export async function getClientAccessInfo(clientId: string) {
  return db.client.findUnique({ where: { id: clientId }, select: { id: true, assignedMarketerId: true } });
}
