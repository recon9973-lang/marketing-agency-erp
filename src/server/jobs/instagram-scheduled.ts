// src/server/jobs/instagram-scheduled.ts
//
// 인스타 예약 발행(크론) — scheduledAt 도래한 QUEUED 발행분을 발행한다(멱등: 발행 후 PUBLISHED 전이).
// 계정 tokenRef 환경변수 미설정이면 건너뛰고 error 기록. 크론 하루 여러 번 호출 안전.
import { db } from "@/server/db";
import { listDueInstagramPosts } from "@/server/repositories/instagram";
import { publishToAccount, resolveTarget } from "@/server/marketing/providers/instagram-multi";

export type InstaScheduledResult = { due: number; published: number; failed: number; skipped: number };

export async function runInstagramScheduledPublish(now = new Date(), limit = 5): Promise<InstaScheduledResult> {
  const due = await listDueInstagramPosts(now, limit);
  let published = 0, failed = 0, skipped = 0;

  for (const post of due) {
    if (!post.account.active) { skipped++; continue; }
    const target = resolveTarget(post.account);
    if (!target) {
      await db.instagramPost.update({ where: { id: post.id }, data: { status: "FAILED", error: `계정 토큰 미설정(${post.account.tokenRef})` } });
      skipped++;
      continue;
    }
    const images = Array.isArray(post.images) ? (post.images as unknown[]).filter((x): x is string => typeof x === "string") : [];
    const res = await publishToAccount(target, images, post.caption);
    if (res.ok) {
      await db.instagramPost.update({ where: { id: post.id }, data: { status: "PUBLISHED", publishedAt: new Date(), mediaId: res.data.id, permalink: res.data.permalink ?? null, error: null } });
      published++;
    } else {
      await db.instagramPost.update({ where: { id: post.id }, data: { status: "FAILED", error: res.error.message } });
      failed++;
    }
  }
  return { due: due.length, published, failed, skipped };
}
