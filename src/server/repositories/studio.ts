// 디자인 스튜디오 — 프로젝트 조회(조직 스코프). 쓰기는 actions/studio.ts.
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";
import { parseDoc, type StudioDoc } from "@/domain/studio/schema";

export type StudioProjectListItem = {
  id: string;
  title: string;
  kind: string;
  canvasW: number;
  canvasH: number;
  thumbnail: string | null;
  folderId: string | null;
  updatedAt: Date;
};

export type StudioFolderItem = { id: string; name: string; count: number };

/** 조직 폴더 목록(+ 각 폴더의 디자인 수). 테이블 미생성 시 빈 배열. */
export async function listStudioFolders(orgId: string): Promise<StudioFolderItem[]> {
  try {
    const folders = await db.studioFolder.findMany({ where: { orgId }, orderBy: { name: "asc" } });
    if (folders.length === 0) return [];
    const counts = await db.studioProject.groupBy({
      by: ["folderId"],
      where: { orgId, status: "DRAFT", folderId: { in: folders.map((f) => f.id) } },
      _count: { _all: true }
    });
    const countMap = new Map(counts.map((c) => [c.folderId, c._count._all]));
    return folders.map((f) => ({ id: f.id, name: f.name, count: countMap.get(f.id) ?? 0 }));
  } catch {
    return [];
  }
}

/** 미분류(폴더 미배정) 디자인 수. */
export async function countRootStudioProjects(orgId: string): Promise<number> {
  try {
    return await db.studioProject.count({ where: { orgId, status: "DRAFT", folderId: null } });
  } catch {
    return 0;
  }
}

export type StudioProjectDetail = StudioProjectListItem & {
  ownerId: string;
  doc: StudioDoc;
};

/**
 * 조직 내 프로젝트 목록(최근 수정순). MVP: 조직 단위 공유.
 * folderFilter: undefined=전체 / null=미분류만 / string=해당 폴더만.
 */
export async function listStudioProjects(
  orgId: string,
  opts: { limit?: number; folderFilter?: string | null } = {}
): Promise<StudioProjectListItem[]> {
  const { limit = 60, folderFilter } = opts;
  const rows = await db.studioProject.findMany({
    where: {
      orgId,
      status: "DRAFT",
      ...(folderFilter === undefined ? {} : { folderId: folderFilter })
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, title: true, kind: true, canvasW: true, canvasH: true, thumbnail: true, folderId: true, updatedAt: true }
  });
  return rows;
}

/** 단건 상세. 조직 불일치면 null(권한 격리). */
export async function getStudioProject(orgId: string, id: string): Promise<StudioProjectDetail | null> {
  const row = await db.studioProject.findUnique({ where: { id } });
  if (!row || row.orgId !== orgId) return null;
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    canvasW: row.canvasW,
    canvasH: row.canvasH,
    thumbnail: row.thumbnail,
    folderId: row.folderId,
    updatedAt: row.updatedAt,
    ownerId: row.ownerId,
    doc: parseDoc(row.data, row.canvasW, row.canvasH)
  };
}

/** 현재 사용자 접근 가능한 org 프로젝트인지 확인하고 소유 원본을 반환(쓰기 전 검증용). */
export async function assertProjectAccess(user: CurrentUser, orgId: string, id: string) {
  const row = await db.studioProject.findUnique({
    where: { id },
    select: { id: true, orgId: true, ownerId: true, title: true }
  });
  if (!row || row.orgId !== orgId) throw new Error("NOT_FOUND");
  return row;
}
