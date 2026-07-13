import { db } from "@/server/db";
import type { PlatformKind, UpdateCategory } from "@/domain/platform-updates";

export type PlatformUpdateItem = {
  id: string;
  platform: PlatformKind;
  category: UpdateCategory;
  title: string;
  url: string | null;
  summary: string | null;
  source: string;
  publishedAt: string; // ISO — 클라이언트에서 NEW·상대시간 계산
  pinned: boolean;
  isManual: boolean;
};

/**
 * 배너용 최근 공지 — 고정(pinned) 우선, 그다음 게시일 내림차순.
 * 클라이언트가 NEW 판정을 하도록 publishedAt을 ISO로 넘긴다.
 */
export async function listRecentPlatformUpdates(limit = 20): Promise<PlatformUpdateItem[]> {
  const rows = await db.platformUpdate.findMany({
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    take: Math.max(1, Math.min(50, limit)),
    select: {
      id: true, platform: true, category: true, title: true, url: true,
      summary: true, source: true, publishedAt: true, pinned: true, isManual: true
    }
  });

  return rows.map((r) => ({
    id: r.id,
    platform: r.platform as PlatformKind,
    category: r.category as UpdateCategory,
    title: r.title,
    url: r.url,
    summary: r.summary,
    source: r.source,
    publishedAt: r.publishedAt.toISOString(),
    pinned: r.pinned,
    isManual: r.isManual
  }));
}

export type AdminPlatformUpdateRow = PlatformUpdateItem & { createdAt: string };

/** 관리자 관리 목록 — 최근 등록/수집 순. */
export async function listPlatformUpdatesForAdmin(limit = 60): Promise<AdminPlatformUpdateRow[]> {
  const rows = await db.platformUpdate.findMany({
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    take: Math.max(1, Math.min(200, limit)),
    select: {
      id: true, platform: true, category: true, title: true, url: true,
      summary: true, source: true, publishedAt: true, pinned: true, isManual: true, createdAt: true
    }
  });

  return rows.map((r) => ({
    id: r.id,
    platform: r.platform as PlatformKind,
    category: r.category as UpdateCategory,
    title: r.title,
    url: r.url,
    summary: r.summary,
    source: r.source,
    publishedAt: r.publishedAt.toISOString(),
    pinned: r.pinned,
    isManual: r.isManual,
    createdAt: r.createdAt.toISOString()
  }));
}
