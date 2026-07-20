// 아이디어 노트 조회 — 작성자 본인 기준. 쓰기는 actions/idea.ts.
import { db } from "@/server/db";
import { listClientsForUser } from "@/server/repositories/clients";
import type { CurrentUser } from "@/server/session";

export type IdeaRow = {
  id: string;
  title: string;
  idea: string;
  goal: string | null;
  audience: string | null;
  constraints: string | null;
  success: string | null;
  plan: string | null;
  status: string;
  clientId: string | null;
  clientName: string | null;
  updatedAt: string;
};

export type IdeaScope = { ideas: IdeaRow[]; clients: { id: string; name: string }[] };

export async function listIdeas(user: CurrentUser): Promise<IdeaScope> {
  const clients = await listClientsForUser(user).catch(() => []);
  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }));
  const nameMap = new Map(clients.map((c) => [c.id, c.name]));

  let rows: Awaited<ReturnType<typeof db.ideaNote.findMany>> = [];
  try {
    rows = await db.ideaNote.findMany({ where: { authorId: user.id }, orderBy: { updatedAt: "desc" }, take: 100 });
  } catch {
    return { ideas: [], clients: clientOptions };
  }

  const ideas: IdeaRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    idea: r.idea,
    goal: r.goal,
    audience: r.audience,
    constraints: r.constraints,
    success: r.success,
    plan: r.plan,
    status: r.status,
    clientId: r.clientId,
    clientName: r.clientId ? nameMap.get(r.clientId) ?? null : null,
    updatedAt: r.updatedAt.toISOString()
  }));
  return { ideas, clients: clientOptions };
}
