import type { Prisma } from "@prisma/client";
import type { ReportFormInput } from "@/domain/report";
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

// --- 보고서 작성/승인 (V2 §6) ---

export type ReportDetail = {
  id: string;
  clientId: string;
  reportingMonth: string;
  title: string;
  notes: string | null;
};

export type ReportAccessInfo = {
  id: string;
  clientId: string;
  authorId: string;
  status: ReportStatus;
  clientAssignedMarketerId: string | null;
};

function reportMonth(isoDate: string) {
  return new Date(`${isoDate.slice(0, 7)}-01T00:00:00.000Z`);
}

export async function getReportDetail(reportId: string): Promise<ReportDetail | null> {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { id: true, clientId: true, reportingMonth: true, title: true, notes: true }
  });

  if (!report) {
    return null;
  }

  return {
    id: report.id,
    clientId: report.clientId,
    reportingMonth: report.reportingMonth.toISOString().slice(0, 10),
    title: report.title,
    notes: report.notes
  };
}

export type ReportEmailData = {
  title: string;
  clientName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  reportingMonth: Date;
  metrics: Array<{ label: string; value: string }>;
  notes: string | null;
};

/** 보고서 발송(메일·알림톡)에 필요한 데이터(거래처 연락처 포함)를 모은다. */
export async function getReportEmailData(reportId: string): Promise<ReportEmailData | null> {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: {
      title: true,
      reportingMonth: true,
      metrics: true,
      notes: true,
      client: { select: { name: true, contactEmail: true, contactPhone: true } }
    }
  });

  if (!report) {
    return null;
  }

  const metrics: Array<{ label: string; value: string }> = [];
  if (report.metrics && typeof report.metrics === "object" && !Array.isArray(report.metrics)) {
    for (const [label, value] of Object.entries(report.metrics)) {
      metrics.push({ label, value: String(value) });
    }
  }

  return {
    title: report.title,
    clientName: report.client.name,
    contactEmail: report.client.contactEmail,
    contactPhone: report.client.contactPhone,
    reportingMonth: report.reportingMonth,
    metrics,
    notes: report.notes
  };
}

export async function getReportAccessInfo(reportId: string): Promise<ReportAccessInfo | null> {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      clientId: true,
      authorId: true,
      status: true,
      client: { select: { assignedMarketerId: true } }
    }
  });

  if (!report) {
    return null;
  }

  return {
    id: report.id,
    clientId: report.clientId,
    authorId: report.authorId,
    status: report.status,
    clientAssignedMarketerId: report.client.assignedMarketerId
  };
}

export async function createReport(input: ReportFormInput, authorId: string): Promise<{ id: string }> {
  return db.report.create({
    data: {
      clientId: input.clientId,
      authorId,
      reportingMonth: reportMonth(input.reportingMonth),
      title: input.title,
      notes: input.notes ?? null
    },
    select: { id: true }
  });
}

export async function updateReport(reportId: string, input: ReportFormInput): Promise<{ id: string }> {
  return db.report.update({
    where: { id: reportId },
    data: {
      clientId: input.clientId,
      reportingMonth: reportMonth(input.reportingMonth),
      title: input.title,
      notes: input.notes ?? null
    },
    select: { id: true }
  });
}

export type ReportStatusData = {
  status: ReportStatus;
  reviewerId?: string;
  reviewedAt?: Date | null;
  deliveredAt?: Date;
};

export async function changeReportStatus(
  reportId: string,
  data: ReportStatusData
): Promise<{ id: string; status: ReportStatus }> {
  return db.report.update({
    where: { id: reportId },
    data,
    select: { id: true, status: true }
  });
}
