import type { Prisma } from "@prisma/client";
import { ReportStatus, Role } from "@/domain/types";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

type AdminScope = {
  clientId: string | null;
  marketerId: string | null;
  allClients: boolean;
  allMarketers: boolean;
};

export type ReportListItem = {
  id: string;
  title: string;
  clientName: string;
  authorName: string;
  reviewerName: string | null;
  reportingMonth: Date;
  status: ReportStatus;
  notes: string | null;
  attachmentUrl: string | null;
  reviewedAt: Date | null;
  deliveredAt: Date | null;
  metricsSummary: string;
};

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function summarizeMetrics(metrics: Prisma.JsonValue | null) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    return "성과 지표 미입력";
  }

  return Object.entries(metrics)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

function buildAdminReportWhere(scopes: AdminScope[]): Prisma.ReportWhereInput {
  if (scopes.some((scope) => scope.allClients)) {
    return {};
  }

  const clientIds = unique(scopes.map((scope) => scope.clientId));
  const marketerIds = unique(scopes.map((scope) => scope.marketerId));
  const allMarketers = scopes.some((scope) => scope.allMarketers);
  const clauses: Prisma.ReportWhereInput[] = [];

  if (clientIds.length > 0) {
    clauses.push({ clientId: { in: clientIds } });
  }

  if (allMarketers) {
    clauses.push({ client: { assignedMarketerId: { not: null } } });
    clauses.push({ author: { role: Role.MARKETER } });
  } else if (marketerIds.length > 0) {
    clauses.push({ client: { assignedMarketerId: { in: marketerIds } } });
    clauses.push({ authorId: { in: marketerIds } });
  }

  return clauses.length > 0 ? { OR: clauses } : { id: { in: [] } };
}

async function buildReportWhere(user: CurrentUser): Promise<Prisma.ReportWhereInput> {
  if (user.role === Role.SUPER_ADMIN) {
    return {};
  }

  if (user.role === Role.MARKETER) {
    return {
      OR: [{ authorId: user.id }, { client: { assignedMarketerId: user.id } }]
    };
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

  return buildAdminReportWhere(scopes);
}

export async function fetchReportsForUser(user: CurrentUser): Promise<ReportListItem[]> {
  const reports = await db.report.findMany({
    where: await buildReportWhere(user),
    orderBy: [{ reportingMonth: "desc" }, { updatedAt: "desc" }],
    take: 50,
    select: {
      id: true,
      title: true,
      reportingMonth: true,
      status: true,
      metrics: true,
      notes: true,
      attachmentUrl: true,
      reviewedAt: true,
      deliveredAt: true,
      client: { select: { name: true } },
      author: { select: { name: true } },
      reviewer: { select: { name: true } }
    }
  });

  return reports.map((report) => ({
    id: report.id,
    title: report.title,
    clientName: report.client.name,
    authorName: report.author.name,
    reviewerName: report.reviewer?.name ?? null,
    reportingMonth: report.reportingMonth,
    status: report.status,
    notes: report.notes,
    attachmentUrl: report.attachmentUrl,
    reviewedAt: report.reviewedAt,
    deliveredAt: report.deliveredAt,
    metricsSummary: summarizeMetrics(report.metrics)
  }));
}


export type ReportDetail = {
  id: string;
  title: string;
  status: ReportStatus;
  metrics: Record<string, unknown> | null;
  clientName: string;
  reportingMonth: Date;
};

/**
 * 단일 보고서 상세. buildReportWhere로 접근 권한을 강제한다
 * (권한 없는 보고서 id는 null 반환 → 페이지에서 notFound 처리).
 */
export async function fetchReportDetail(user: CurrentUser, id: string): Promise<ReportDetail | null> {
  const report = await db.report.findFirst({
    where: { AND: [{ id }, await buildReportWhere(user)] },
    select: {
      id: true,
      title: true,
      status: true,
      metrics: true,
      reportingMonth: true,
      client: { select: { name: true } }
    }
  });

  if (!report) {
    return null;
  }

  return {
    id: report.id,
    title: report.title,
    status: report.status,
    metrics: (report.metrics as Record<string, unknown> | null) ?? null,
    clientName: report.client.name,
    reportingMonth: report.reportingMonth
  };
}
