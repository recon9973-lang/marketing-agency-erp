import type { Prisma } from "@prisma/client";
import { Role } from "@/domain/types";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

export type AiContentItem = {
  id: string;
  kind: string;
  topic: string;
  keywords: string | null;
  tone: string | null;
  result: string;
  model: string | null;
  status: string;
  clientName: string | null;
  authorName: string;
  createdAt: Date;
};

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

// 접근 규칙: 본인이 만든 것은 항상 보이고, 거래처 연계분은 거래처 접근 범위를 따른다.
async function buildWhere(user: CurrentUser): Promise<Prisma.AiContentWhereInput> {
  if (user.role === Role.SUPER_ADMIN) return {};
  if (user.role === Role.MARKETER) {
    return { OR: [{ authorId: user.id }, { client: { assignedMarketerId: user.id } }] };
  }
  // ADMIN: AccessScope 기반 + 본인 작성분
  const scopes = await db.accessScope.findMany({
    where: { adminId: user.id },
    select: { clientId: true, marketerId: true, allClients: true, allMarketers: true }
  });
  if (scopes.some((s) => s.allClients)) return {};
  const clientIds = unique(scopes.map((s) => s.clientId));
  const marketerIds = unique(scopes.map((s) => s.marketerId));
  const allMarketers = scopes.some((s) => s.allMarketers);
  const clauses: Prisma.AiContentWhereInput[] = [{ authorId: user.id }];
  if (clientIds.length > 0) clauses.push({ clientId: { in: clientIds } });
  if (allMarketers) clauses.push({ client: { assignedMarketerId: { not: null } } });
  else if (marketerIds.length > 0) clauses.push({ client: { assignedMarketerId: { in: marketerIds } } });
  return { OR: clauses };
}

export async function listAiContentForUser(user: CurrentUser): Promise<AiContentItem[]> {
  const rows = await db.aiContent.findMany({
    where: await buildWhere(user),
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      kind: true,
      topic: true,
      keywords: true,
      tone: true,
      result: true,
      model: true,
      status: true,
      createdAt: true,
      client: { select: { name: true } },
      author: { select: { name: true } }
    }
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    topic: r.topic,
    keywords: r.keywords,
    tone: r.tone,
    result: r.result,
    model: r.model,
    status: r.status,
    clientName: r.client?.name ?? null,
    authorName: r.author.name,
    createdAt: r.createdAt
  }));
}
