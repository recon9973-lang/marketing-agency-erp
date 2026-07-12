// 목표 경로: src/server/repositories/dashboard-extras.ts
//
// 대시보드 홈 리디자인용 부가 데이터 — 의료법 위험 콘텐츠 위젯 + 전사 모니터링 롤업.
import { BillingStatus, Role, WorkStatus } from "@/domain/types";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

export type RiskItem = { id: string; clientName: string; topic: string; high: number; medium: number; topFlag: string | null };

/** 최근 콘텐츠 기획 중 의료법 위험이 감지된 항목. 담당자는 본인 거래처만. */
export async function listComplianceRiskItems(user: CurrentUser): Promise<RiskItem[]> {
  const where = user.role === Role.MARKETER ? { client: { assignedMarketerId: user.id } } : {};
  const rows = await db.contentPlan.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, topic: true, complianceRisk: true, client: { select: { name: true } } }
  });
  const items: RiskItem[] = [];
  for (const r of rows) {
    const cr = r.complianceRisk as { high?: number; medium?: number; flags?: { label?: string }[] } | null;
    if (!cr) continue;
    const high = cr.high ?? 0;
    const medium = cr.medium ?? 0;
    if (high + medium === 0) continue;
    items.push({ id: r.id, clientName: r.client.name, topic: r.topic, high, medium, topFlag: cr.flags?.[0]?.label ?? null });
    if (items.length >= 6) break;
  }
  return items;
}

export type ClientMonitorRow = { id: string; name: string; total: number; delayed: number; review: number; outstanding: number };

const OUTSTANDING_STATUSES = [
  BillingStatus.ISSUED,
  BillingStatus.UNPAID,
  BillingStatus.PARTIALLY_PAID,
  BillingStatus.OVERDUE
];

/**
 * 전사 운영 모니터링 — 거래처별 업무(전체/지연/검토)와 미수금 롤업.
 * 전사 지표라 최고관리자 전용. 지연 상위·미수금 상위 순으로 정렬.
 */
export async function listClientMonitor(user: CurrentUser, today: string): Promise<ClientMonitorRow[]> {
  if (user.role !== Role.SUPER_ADMIN) return [];

  const todayStart = new Date(`${today}T00:00:00+09:00`);
  const [clients, totals, delayed, reviews, billing] = await Promise.all([
    db.client.findMany({ where: { active: true }, select: { id: true, name: true } }),
    db.workItem.groupBy({ by: ["clientId"], _count: { _all: true } }),
    db.workItem.groupBy({
      by: ["clientId"],
      where: { status: { not: WorkStatus.COMPLETED }, dueDate: { lt: todayStart } },
      _count: { _all: true }
    }),
    db.workItem.groupBy({ by: ["clientId"], where: { status: WorkStatus.REVIEW_NEEDED }, _count: { _all: true } }),
    db.billingRecord.groupBy({
      by: ["clientId"],
      where: { status: { in: OUTSTANDING_STATUSES } },
      _sum: { issuedAmount: true, paidAmount: true }
    })
  ]);

  const totalMap = new Map(totals.map((row) => [row.clientId, row._count._all]));
  const delayedMap = new Map(delayed.map((row) => [row.clientId, row._count._all]));
  const reviewMap = new Map(reviews.map((row) => [row.clientId, row._count._all]));
  const outstandingMap = new Map(
    billing.map((row) => [row.clientId, Math.max(Number(row._sum.issuedAmount ?? 0) - Number(row._sum.paidAmount ?? 0), 0)])
  );

  const rows: ClientMonitorRow[] = clients.map((client) => ({
    id: client.id,
    name: client.name,
    total: totalMap.get(client.id) ?? 0,
    delayed: delayedMap.get(client.id) ?? 0,
    review: reviewMap.get(client.id) ?? 0,
    outstanding: outstandingMap.get(client.id) ?? 0
  }));

  rows.sort((a, b) => b.delayed - a.delayed || b.outstanding - a.outstanding || b.total - a.total);
  return rows.slice(0, 8);
}

export type PendingConfirm = { id: string; clientName: string; topic: string; month: string; overdue: boolean };
export type ClientResponse = { id: string; clientName: string; message: string; kind: string; createdAt: string };
export type ClientConfirmations = { pending: PendingConfirm[]; recent: ClientResponse[] };

/** 두 시각 사이의 영업일 수(주말 제외, 공휴일 미반영) — §15 병원승인대기 3영업일 알림용. */
export function businessDaysBetween(from: Date, to: Date): number {
  let count = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/**
 * 거래처 컨펌 관리 — 포털에 나간 콘텐츠(REVIEWED) 중 컨펌 대기 + 최근 거래처 응답.
 * 담당자는 본인 거래처만, 관리자/최고관리자는 전체.
 * 병원 승인 대기 3영업일 초과 건은 overdue로 표시(기획서 §15).
 */
export async function listClientConfirmations(user: CurrentUser): Promise<ClientConfirmations> {
  const clientScope = user.role === Role.MARKETER ? { assignedMarketerId: user.id } : undefined;
  const planWhere = clientScope ? { status: "REVIEWED", clientConfirmedAt: null, client: clientScope } : { status: "REVIEWED", clientConfirmedAt: null };
  const feedbackWhere = clientScope ? { client: clientScope } : {};

  const [pendingRows, recentRows] = await Promise.all([
    db.contentPlan.findMany({
      where: planWhere,
      orderBy: { updatedAt: "asc" }, // 오래 대기한 건이 먼저 보이도록
      take: 6,
      select: { id: true, topic: true, month: true, updatedAt: true, client: { select: { name: true } } }
    }),
    db.clientFeedback.findMany({
      where: feedbackWhere,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, message: true, kind: true, createdAt: true, client: { select: { name: true } } }
    })
  ]);

  const now = new Date();
  return {
    pending: pendingRows.map((p) => ({
      id: p.id,
      clientName: p.client.name,
      topic: p.topic,
      month: p.month,
      overdue: businessDaysBetween(p.updatedAt, now) >= 3
    })),
    recent: recentRows.map((r) => ({ id: r.id, clientName: r.client.name, message: r.message, kind: r.kind, createdAt: r.createdAt.toISOString() }))
  };
}
