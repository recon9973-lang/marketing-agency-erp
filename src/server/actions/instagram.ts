// src/server/actions/instagram.ts
//
// 인스타 관리 액션 — 계정 추가/토글, 발행 예약(DRAFT/QUEUED), 즉시 발행, 삭제.
// 토큰은 DB에 저장하지 않고 tokenRef(환경변수 이름)로만 참조한다(보안).
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import { publishToAccount, resolveTarget } from "@/server/marketing/providers/instagram-multi";
import { recordAudit, requestMeta, requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";

const accountSchema = z.object({
  name: z.string().trim().min(1).max(60),
  handle: z.string().trim().min(1).max(60).transform((s) => s.replace(/^@/, "")),
  igBusinessId: z.string().trim().regex(/^\d{5,25}$/, "숫자 ID"),
  tokenRef: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,60}$/, "환경변수 이름(대문자/숫자/_)"),
  graphVersion: z.string().trim().regex(/^v\d+\.\d+$/).default("v21.0")
});

export async function addInstagramAccount(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = accountSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const orgId = await getDefaultOrgId();
    const created = await db.$transaction(async (tx) => {
      const acc = await tx.instagramAccount.create({ data: { ...p.data, orgId } });
      await recordAudit(tx, { actorId: user.id, action: "instagram.addAccount", targetType: "InstagramAccount", targetId: acc.id, afterState: { name: acc.name, handle: acc.handle }, ...(await requestMeta()) });
      return acc;
    });
    revalidatePath("/insta");
    return { id: created.id };
  });
}

export async function toggleInstagramAccount(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    const p = z.object({ id: z.string().min(1), active: z.boolean() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await db.instagramAccount.update({ where: { id: p.data.id }, data: { active: p.data.active } });
    revalidatePath("/insta");
  });
}

const postSchema = z.object({
  accountId: z.string().min(1),
  caption: z.string().trim().min(1).max(2200),
  images: z.array(z.string().url()).min(1).max(10),
  scheduledAt: z.string().datetime().optional().nullable()
});

/** 발행분 저장 — scheduledAt 있으면 QUEUED(예약), 없으면 DRAFT. */
export async function saveInstagramPost(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = postSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    const account = await db.instagramAccount.findUnique({ where: { id: d.accountId }, select: { id: true } });
    if (!account) throw new Error("NOT_FOUND");
    const orgId = await getDefaultOrgId();
    const post = await db.instagramPost.create({
      data: {
        accountId: d.accountId, caption: d.caption, images: d.images,
        status: d.scheduledAt ? "QUEUED" : "DRAFT",
        scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null,
        createdById: user.id, orgId
      }
    });
    revalidatePath("/insta");
    return { id: post.id };
  });
}

export async function deleteInstagramPost(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    // 발행 완료분은 기록 보존 — 삭제 금지.
    const post = await db.instagramPost.findUnique({ where: { id: p.data.id }, select: { status: true } });
    if (post?.status === "PUBLISHED") throw new Error("PUBLISHED_LOCKED");
    await db.instagramPost.delete({ where: { id: p.data.id } });
    revalidatePath("/insta");
  });
}

/** 즉시 발행 — 예약을 기다리지 않고 지금 발행한다. */
export async function publishInstagramPostNow(input: unknown): Promise<ActionResult<{ mediaId: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const post = await db.instagramPost.findUnique({ where: { id: p.data.id }, include: { account: true } });
    if (!post) throw new Error("NOT_FOUND");
    if (post.status === "PUBLISHED") throw new Error("ALREADY_PUBLISHED");
    const target = resolveTarget(post.account);
    if (!target) throw new Error("ACCOUNT_NOT_CONFIGURED"); // tokenRef 환경변수 미설정

    const images = Array.isArray(post.images) ? (post.images as unknown[]).filter((x): x is string => typeof x === "string") : [];
    const res = await publishToAccount(target, images, post.caption);
    if (!res.ok) {
      await db.instagramPost.update({ where: { id: post.id }, data: { status: "FAILED", error: res.error.message } });
      throw new Error(res.error.code === "UNAUTHORIZED" ? "IG_UNAUTHORIZED" : "IG_PUBLISH_FAILED");
    }
    await db.$transaction(async (tx) => {
      await tx.instagramPost.update({ where: { id: post.id }, data: { status: "PUBLISHED", publishedAt: new Date(), mediaId: res.data.id, permalink: res.data.permalink ?? null, error: null } });
      await recordAudit(tx, { actorId: user.id, action: "instagram.publish", targetType: "InstagramPost", targetId: post.id, afterState: { mediaId: res.data.id, account: post.account.handle }, ...(await requestMeta()) });
    });
    revalidatePath("/insta");
    return { mediaId: res.data.id };
  });
}
