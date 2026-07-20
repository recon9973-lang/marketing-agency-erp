// 업무 보고(작업 결과물) 조회 — 접근 가능한 거래처 범위로 스코프. 쓰기는 actions/work-report.ts.
import { db } from "@/server/db";
import { listClientsForUser } from "@/server/repositories/clients";
import type { CurrentUser } from "@/server/session";

export type WorkReportRow = {
  id: string;
  clientId: string;
  clientName: string;
  authorId: string;
  authorName: string;
  workItemId: string | null;
  workItemTitle: string | null;
  workDate: string; // YYYY-MM-DD
  category: string;
  title: string;
  link: string | null;
  note: string | null;
  createdAt: string;
};

export type WorkItemOption = { id: string; title: string; clientId: string };

export type WorkReportScope = {
  reports: WorkReportRow[];
  clients: { id: string; name: string }[];
  workItems: WorkItemOption[];
};

/** 접근 가능한 거래처의 업무 보고를 최신순으로. 담당자는 본인 거래처, 관리자는 스코프, 최고관리자는 전체. */
export async function listWorkReports(
  user: CurrentUser,
  filters: { clientId?: string; date?: string } = {}
): Promise<WorkReportScope> {
  const clients = await listClientsForUser(user);
  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }));
  const nameMap = new Map(clients.map((c) => [c.id, c.name]));
  const accessibleIds = clients.map((c) => c.id);
  if (accessibleIds.length === 0) return { reports: [], clients: clientOptions, workItems: [] };

  // 연결 후보 업무(완료 제외) — 접근 가능한 거래처 범위.
  let workItems: WorkItemOption[] = [];
  try {
    const wi = await db.workItem.findMany({
      where: { clientId: { in: accessibleIds }, status: { not: "COMPLETED" } },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: { id: true, title: true, clientId: true }
    });
    workItems = wi.map((w) => ({ id: w.id, title: w.title, clientId: w.clientId }));
  } catch {
    workItems = [];
  }

  const where: Record<string, unknown> = { clientId: { in: accessibleIds } };
  if (filters.clientId && accessibleIds.includes(filters.clientId)) where.clientId = filters.clientId;
  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00`);
    const end = new Date(`${filters.date}T23:59:59.999`);
    where.workDate = { gte: start, lte: end };
  }

  let rows: Awaited<ReturnType<typeof db.workReport.findMany>> = [];
  try {
    rows = await db.workReport.findMany({ where, orderBy: [{ workDate: "desc" }, { createdAt: "desc" }], take: 200 });
  } catch {
    // 테이블 미생성 등에도 화면이 죽지 않게.
    return { reports: [], clients: clientOptions, workItems };
  }

  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const authors = await db.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } });
  const authorMap = new Map(authors.map((a) => [a.id, a.name]));
  // 연결 업무 제목 — 목록에 있으면 재사용, 없으면(완료된 업무 등) 별도 조회.
  const wiTitleMap = new Map(workItems.map((w) => [w.id, w.title]));
  const missingWiIds = [...new Set(rows.map((r) => r.workItemId).filter((id): id is string => Boolean(id) && !wiTitleMap.has(id!)))];
  if (missingWiIds.length > 0) {
    const extra = await db.workItem.findMany({ where: { id: { in: missingWiIds } }, select: { id: true, title: true } }).catch(() => []);
    for (const w of extra) wiTitleMap.set(w.id, w.title);
  }

  const reports: WorkReportRow[] = rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    clientName: nameMap.get(r.clientId) ?? "(거래처)",
    authorId: r.authorId,
    authorName: authorMap.get(r.authorId) ?? "(직원)",
    workItemId: r.workItemId,
    workItemTitle: r.workItemId ? wiTitleMap.get(r.workItemId) ?? null : null,
    workDate: r.workDate.toISOString().slice(0, 10),
    category: r.category,
    title: r.title,
    link: r.link,
    note: r.note,
    createdAt: r.createdAt.toISOString()
  }));

  return { reports, clients: clientOptions, workItems };
}
