// 목표 경로: src/server/repositories/leads.ts
//
// 영업 리드 조회. MARKETER는 본인 배정(또는 미배정) 리드만, 관리자 이상은 전체.
import { Role } from "@/domain/types";
import type { LeadStatus } from "@/domain/sales/lead-stages";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

export type LeadListItem = {
  id: string;
  hospitalName: string;
  department: string | null;
  region: string | null;
  source: string | null;
  status: string;
  grade: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  adBudgetEstimate: number | null;
  auditScore: number | null;
  nextActionAt: string | null;
  clientId: string | null;
  createdAt: string;
};

export type LeadFilters = {
  status?: LeadStatus;
  assigneeId?: string;
  search?: string;
};

function scopeWhere(user: CurrentUser) {
  if (user.role === Role.MARKETER) {
    return { OR: [{ assigneeId: user.id }, { assigneeId: null }] };
  }
  return {};
}

export async function listLeads(user: CurrentUser, filters: LeadFilters = {}): Promise<LeadListItem[]> {
  const rows = await db.lead.findMany({
    where: {
      ...scopeWhere(user),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.search
        ? {
            OR: [
              { hospitalName: { contains: filters.search, mode: "insensitive" as const } },
              { region: { contains: filters.search, mode: "insensitive" as const } },
              { department: { contains: filters.search, mode: "insensitive" as const } }
            ]
          }
        : {})
    },
    include: { assignee: { select: { name: true } } },
    orderBy: [{ nextActionAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 500
  });
  return rows.map((r) => ({
    id: r.id,
    hospitalName: r.hospitalName,
    department: r.department,
    region: r.region,
    source: r.source,
    status: r.status,
    grade: r.grade,
    assigneeId: r.assigneeId,
    assigneeName: r.assignee?.name ?? null,
    contactName: r.contactName,
    contactPhone: r.contactPhone,
    adBudgetEstimate: r.adBudgetEstimate ? Number(r.adBudgetEstimate) : null,
    auditScore: r.auditScore,
    nextActionAt: r.nextActionAt?.toISOString() ?? null,
    clientId: r.clientId,
    createdAt: r.createdAt.toISOString()
  }));
}

export type LeadDetail = LeadListItem & {
  contactEmail: string | null;
  websiteUrl: string | null;
  placeUrl: string | null;
  note: string | null;
  lostReason: string | null;
  consentAt: string | null;
  consentTextVersion: string | null;
  auditChecklist: Record<string, boolean>;
  auditNote: string | null;
};

export async function getLead(user: CurrentUser, id: string): Promise<LeadDetail | null> {
  const r = await db.lead.findUnique({ where: { id }, include: { assignee: { select: { name: true } } } });
  if (!r) return null;
  if (user.role === Role.MARKETER && r.assigneeId && r.assigneeId !== user.id) return null;
  return {
    id: r.id,
    hospitalName: r.hospitalName,
    department: r.department,
    region: r.region,
    source: r.source,
    status: r.status,
    grade: r.grade,
    assigneeId: r.assigneeId,
    assigneeName: r.assignee?.name ?? null,
    contactName: r.contactName,
    contactPhone: r.contactPhone,
    contactEmail: r.contactEmail,
    websiteUrl: r.websiteUrl,
    placeUrl: r.placeUrl,
    note: r.note,
    lostReason: r.lostReason,
    adBudgetEstimate: r.adBudgetEstimate ? Number(r.adBudgetEstimate) : null,
    auditScore: r.auditScore,
    nextActionAt: r.nextActionAt?.toISOString() ?? null,
    clientId: r.clientId,
    createdAt: r.createdAt.toISOString(),
    consentAt: r.consentAt?.toISOString() ?? null,
    consentTextVersion: r.consentTextVersion,
    auditChecklist:
      r.auditChecklist && typeof r.auditChecklist === "object" && !Array.isArray(r.auditChecklist)
        ? (r.auditChecklist as Record<string, boolean>)
        : {},
    auditNote: r.auditNote
  };
}

export type LeadPipelineSummary = {
  byStatus: Record<string, number>;
  recontactDueThisWeek: number;
};

/** 파이프라인 요약 — 상태별 카운트 + 이번 주 재접촉 예정. */
export async function leadPipelineSummary(user: CurrentUser): Promise<LeadPipelineSummary> {
  const scope = scopeWhere(user);
  const groups = await db.lead.groupBy({ by: ["status"], where: scope, _count: { _all: true } });
  const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const recontactDueThisWeek = await db.lead.count({
    where: { ...scope, status: "RECONTACT", nextActionAt: { lte: weekAhead } }
  });
  const byStatus: Record<string, number> = {};
  for (const g of groups) byStatus[g.status] = g._count._all;
  return { byStatus, recontactDueThisWeek };
}