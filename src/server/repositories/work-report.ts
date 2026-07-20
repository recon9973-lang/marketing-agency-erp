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
  workDate: string; // YYYY-MM-DD
  category: string;
  title: string;
  link: string | null;
  note: string | null;
  createdAt: string;
};

export type WorkReportScope = {
  reports: WorkReportRow[];
  clients: { id: string; name: string }[];
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
  if (accessibleIds.length === 0) return { reports: [], clients: clientOptions };

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
    return { reports: [], clients: clientOptions };
  }

  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const authors = await db.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } });
  const authorMap = new Map(authors.map((a) => [a.id, a.name]));

  const reports: WorkReportRow[] = rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    clientName: nameMap.get(r.clientId) ?? "(거래처)",
    authorId: r.authorId,
    authorName: authorMap.get(r.authorId) ?? "(직원)",
    workDate: r.workDate.toISOString().slice(0, 10),
    category: r.category,
    title: r.title,
    link: r.link,
    note: r.note,
    createdAt: r.createdAt.toISOString()
  }));

  return { reports, clients: clientOptions };
}
