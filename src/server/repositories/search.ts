// ERP 내부 검색 — 데이터(거래처·업무·계약·보고서·파일) 서버 검색.
//
// 접근 제어: 거래처 스코프(buildClientWhere)를 관계 필터로 재사용해, 사용자가 볼 수 있는
// 거래처에 속한 항목만 검색된다. 페이지 바로가기·사용방법은 domain/search/catalog.ts(클라이언트)가 담당.
import { Role } from "@/domain/types";
import type { CurrentUser } from "@/domain/access-control";
import { db } from "@/server/db";
import { buildClientWhere } from "@/server/repositories/clients";

export type SearchHitType =
  | "client"
  | "work"
  | "contract"
  | "report"
  | "content"
  | "meeting"
  | "magazine"
  | "file";

export type SearchHit = {
  type: SearchHitType;
  id: string;
  title: string;
  sublabel: string | null;
  href: string;
};

const PER_TYPE = 5;

/** 빠른 접근 — 내가 즐겨찾기한 거래처(빈 검색 상태에 노출). 즐겨찾기는 본인 소유라 자체 스코프. */
export async function quickAccessFavorites(user: CurrentUser): Promise<SearchHit[]> {
  const favs = await db.clientFavorite
    .findMany({
      where: { userId: user.id },
      select: { client: { select: { id: true, name: true, region: true } } },
      take: 8,
      orderBy: { createdAt: "desc" }
    })
    .catch(() => []);
  return favs
    .filter((f) => f.client)
    .map((f) => ({
      type: "client" as const,
      id: f.client.id,
      title: f.client.name,
      sublabel: f.client.region ?? null,
      href: `/clients/${f.client.id}`
    }));
}

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

  // 회의록: 거래처 연결이 선택이라, 관리자는 사내(무-거래처) 회의도 검색 가능.
  const meetingWhere =
    user.role === Role.MARKETER
      ? { title: contains, client: clientWhere }
      : { title: contains, OR: [{ client: clientWhere }, { clientId: null }] };

  const [clients, works, contracts, reports, contents, meetings, magazines, files] = await Promise.all([
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
      db.contentPlan.findMany({
        where: { topic: contains, client: clientWhere },
        select: { id: true, topic: true, month: true, client: { select: { name: true } } },
        take: PER_TYPE,
        orderBy: { updatedAt: "desc" }
      })
    ),
    safe(
      db.meeting.findMany({
        where: meetingWhere,
        select: { id: true, title: true, client: { select: { name: true } } },
        take: PER_TYPE,
        orderBy: { updatedAt: "desc" }
      })
    ),
    safe(
      db.magazinePost.findMany({
        where: { title: contains },
        select: { id: true, title: true, status: true },
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
  for (const cp of contents) {
    hits.push({ type: "content", id: cp.id, title: cp.topic, sublabel: `${cp.client?.name ?? ""} ${cp.month}`.trim(), href: "/manuscript" });
  }
  for (const m of meetings) {
    hits.push({ type: "meeting", id: m.id, title: m.title, sublabel: m.client?.name ?? "사내", href: `/meetings/${m.id}` });
  }
  for (const mg of magazines) {
    hits.push({ type: "magazine", id: mg.id, title: mg.title, sublabel: mg.status, href: "/magazine" });
  }
  for (const f of files) {
    hits.push({ type: "file", id: f.id, title: f.fileName, sublabel: f.folder?.name ?? null, href: "/vault" });
  }
  return hits;
}
