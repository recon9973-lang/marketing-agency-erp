// ERP 내부 검색 — 데이터(거래처·업무·계약·보고서·파일) 서버 검색.
//
// 접근 제어: 거래처 스코프(buildClientWhere)를 관계 필터로 재사용해, 사용자가 볼 수 있는
// 거래처에 속한 항목만 검색된다. 페이지 바로가기·사용방법은 domain/search/catalog.ts(클라이언트)가 담당.
import { Role } from "@/domain/types";
import type { CurrentUser } from "@/domain/access-control";
import { db } from "@/server/db";
import { buildClientWhere } from "@/server/repositories/clients";

export type SearchHitType = "client" | "work" | "contract" | "report" | "file";

export type SearchHit = {
  type: SearchHitType;
  id: string;
  title: string;
  sublabel: string | null;
  href: string;
};

const PER_TYPE = 5;

export async function searchErp(user: CurrentUser, rawQuery: string): Promise<SearchHit[]> {
  const q = rawQuery.trim();
  if (q.length < 1) return [];

  const scopes =
    user.role === Role.SUPER_ADMIN
      ? []
      : await db.accessScope.findMany({ where: { adminId: user.id } });
  const clientWhere = buildClientWhere(user, scopes);
  const contains = { contains: q, mode: "insensitive" as const };

  // 병렬 조회 — 각 타입별 상위 N개. 실패한 타입은 빈 배열로 흡수(검색이 통째로 죽지 않게).
  const safe = <T>(p: Promise<T[]>): Promise<T[]> => p.catch(() => [] as T[]);

  const [clients, works, contracts, reports, files] = await Promise.all([
    safe(
      db.client.findMany({
        where: { AND: [clientWhere, { OR: [{ name: contains }, { code: contains }, { region: contains }] }] },
        select: { id: true, name: true, code: true, region: true },
        take: PER_TYPE,
        orderBy: { updatedAt: "desc" }
      })
    ),
    safe(
      db.workItem.findMany({
        where: { title: contains, client: clientWhere },
        select: { id: true, title: true, status: true, client: { select: { name: true } } },
        take: PER_TYPE,
        orderBy: { updatedAt: "desc" }
      })
    ),
    safe(
      db.contract.findMany({
        where: { title: contains, client: clientWhere },
        select: { id: true, title: true, status: true, client: { select: { name: true } } },
        take: PER_TYPE,
        orderBy: { updatedAt: "desc" }
      })
    ),
    safe(
      db.report.findMany({
        where: { title: contains, client: clientWhere },
        select: { id: true, title: true, client: { select: { name: true } } },
        take: PER_TYPE,
        orderBy: { updatedAt: "desc" }
      })
    ),
    safe(
      db.storedFile.findMany({
        where: { fileName: contains },
        select: { id: true, fileName: true, folder: { select: { name: true } } },
        take: PER_TYPE,
        orderBy: { createdAt: "desc" }
      })
    )
  ]);

  const hits: SearchHit[] = [];
  for (const c of clients) {
    hits.push({ type: "client", id: c.id, title: c.name, sublabel: c.region ?? c.code ?? null, href: `/clients/${c.id}` });
  }
  for (const w of works) {
    hits.push({ type: "work", id: w.id, title: w.title, sublabel: w.client?.name ?? null, href: "/work" });
  }
  for (const ct of contracts) {
    hits.push({ type: "contract", id: ct.id, title: ct.title, sublabel: ct.client?.name ?? null, href: `/contracts/${ct.id}` });
  }
  for (const r of reports) {
    hits.push({ type: "report", id: r.id, title: r.title, sublabel: r.client?.name ?? null, href: "/reports" });
  }
  for (const f of files) {
    hits.push({ type: "file", id: f.id, title: f.fileName, sublabel: f.folder?.name ?? null, href: "/vault" });
  }
  return hits;
}
