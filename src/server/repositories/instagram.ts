// src/server/repositories/instagram.ts
//
// 인스타 관리 조회 — 계정 목록, 발행 큐, 예약 도래분(크론용).
import { db } from "@/server/db";

export type InstaAccountRow = {
  id: string; name: string; handle: string; igBusinessId: string;
  tokenRef: string; graphVersion: string; active: boolean;
  configured: boolean; postCount: number;
};

/** 계정 목록. tokenRef 환경변수가 실제로 설정돼 있는지(configured)만 노출(토큰 원문은 노출 안 함). */
export async function listInstagramAccounts(orgId?: string | null): Promise<InstaAccountRow[]> {
  const rows = await db.instagramAccount.findMany({
    where: orgId ? { orgId } : {},
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { posts: true } } }
  });
  return rows.map((a) => ({
    id: a.id, name: a.name, handle: a.handle, igBusinessId: a.igBusinessId,
    tokenRef: a.tokenRef, graphVersion: a.graphVersion, active: a.active,
    configured: Boolean(process.env[a.tokenRef]?.trim()),
    postCount: a._count.posts
  }));
}

export type InstaPostRow = {
  id: string; accountId: string; accountName: string; caption: string;
  images: string[]; status: string; scheduledAt: Date | null; publishedAt: Date | null;
  mediaId: string | null; permalink: string | null; error: string | null;
};

function toImages(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** 발행 큐(최근순). */
export async function listInstagramPosts(orgId?: string | null, take = 100): Promise<InstaPostRow[]> {
  const rows = await db.instagramPost.findMany({
    where: orgId ? { orgId } : {},
    orderBy: [{ status: "asc" }, { scheduledAt: "asc" }, { createdAt: "desc" }],
    take,
    include: { account: { select: { name: true } } }
  });
  return rows.map((p) => ({
    id: p.id, accountId: p.accountId, accountName: p.account.name, caption: p.caption,
    images: toImages(p.images), status: p.status, scheduledAt: p.scheduledAt, publishedAt: p.publishedAt,
    mediaId: p.mediaId, permalink: p.permalink, error: p.error
  }));
}

/** 예약 시각이 도래한 QUEUED 발행분(크론). */
export async function listDueInstagramPosts(now: Date, limit = 5) {
  return db.instagramPost.findMany({
    where: { status: "QUEUED", scheduledAt: { not: null, lte: now } },
    orderBy: { scheduledAt: "asc" },
    take: limit,
    include: { account: true }
  });
}
