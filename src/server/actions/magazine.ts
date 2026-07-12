// 목표 경로: src/server/actions/magazine.ts
//
// GROUND 매거진 콘텐츠 트랙 액션 — 용어 큐 대량 등록 / 삭제.
// 자사 미디어라 의료법·거래처 승인 게이트가 없다. 사람 검토 게이트(상태 흐름)만 유지.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buildInstagramCaption, buildMagazineMarkdown, isMagazineCategory, isMagazineKind, MAGAZINE_STATUSES, parseMagazineTerms } from "@/domain/content/magazine";
import { db } from "@/server/db";
import { generateMagazineDraft, isAiConfigured } from "@/server/ai/claude";
import { markdownToHtml } from "@/server/marketing/render-plan";
import { wordpressPublish, wordpressUploadMediaFromUrl, wordpressFindCategoryId } from "@/server/marketing/providers/wordpress";
import { instagramConfigured, instagramPublishImage } from "@/server/marketing/providers/instagram";
import { getDefaultOrgId } from "@/server/org";
import { recordAudit, requestMeta, requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";

/** 마크다운 초안에서 선두 "# 제목" 줄 제거(워드프레스 제목과 중복 방지). */
function stripLeadingTitle(md: string): string {
  return md.replace(/^\s*#\s+.*(\r?\n)+/, "");
}

const importSchema = z.object({
  category: z.string().min(1),
  kind: z.string().min(1),
  raw: z.string().min(1).max(50000)
});

/** 용어 리스트 대량 등록 — 붙여넣기 → 파싱 → QUEUED로 큐잉. 기존 제목은 건너뛴다(중복 방지). */
export async function importMagazineQueue(input: unknown): Promise<ActionResult<{ created: number; skipped: number; parsed: number }>> {
  return runAction(async () => {
    const p = importSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    if (!isMagazineCategory(p.data.category) || !isMagazineKind(p.data.kind)) throw new Error("VALIDATION");
    const user = await requireUser();

    const terms = parseMagazineTerms(p.data.raw);
    if (terms.length === 0) throw new Error("NOTHING_TO_PUBLISH");

    // 이미 존재하는 제목은 제외(대소문자 무시)
    const existing = await db.magazinePost.findMany({
      where: { title: { in: terms.map((t) => t.title) } },
      select: { title: true }
    });
    const existingSet = new Set(existing.map((e) => e.title.toLowerCase()));
    const fresh = terms.filter((t) => !existingSet.has(t.title.toLowerCase()));

    const orgId = await getDefaultOrgId();
    const meta = await requestMeta();
    let created = 0;
    if (fresh.length > 0) {
      const res = await db.magazinePost.createMany({
        data: fresh.map((t) => ({
          title: t.title,
          category: p.data.category,
          kind: p.data.kind,
          seed: t.seed,
          status: "QUEUED",
          orgId
        }))
      });
      created = res.count;
      await db.$transaction(async (tx) => {
        await recordAudit(tx, {
          actorId: user.id,
          action: "magazine.import",
          targetType: "MagazinePost",
          targetId: "bulk",
          afterState: { category: p.data.category, kind: p.data.kind, created },
          ...meta
        });
      });
    }

    revalidatePath("/magazine");
    return { created, skipped: terms.length - fresh.length, parsed: terms.length };
  });
}

/** 큐 1건 → AI 초안 생성 → DRAFTED. 자사 미디어라 의료법 게이트 없음(사람 검토는 이후 단계). */
export async function draftMagazinePost(input: unknown): Promise<ActionResult<{ status: string }>> {
  return runAction(async () => {
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    if (!isAiConfigured()) throw new Error("AI_NOT_CONFIGURED");
    const post = await db.magazinePost.findUnique({
      where: { id: p.data.id },
      select: { id: true, title: true, category: true, kind: true, seed: true, status: true }
    });
    if (!post) throw new Error("NOT_FOUND");
    const user = await requireUser();

    const draft = await generateMagazineDraft({ title: post.title, kind: post.kind, category: post.category, seed: post.seed });
    if (!draft.summary && draft.sections.length === 0) throw new Error("AI_EMPTY");
    const markdown = buildMagazineMarkdown(draft);

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.magazinePost.update({ where: { id: p.data.id }, data: { draft: markdown, status: "DRAFTED" } });
      await recordAudit(tx, { actorId: user.id, action: "magazine.draft", targetType: "MagazinePost", targetId: p.data.id, ...meta });
    });
    revalidatePath("/magazine");
    return { status: "DRAFTED" };
  });
}

/** 큐에서 QUEUED 상위 N건을 순차로 초안 생성(안전 램프업). limit는 1~5로 제한. */
export async function draftMagazineBatch(input: unknown): Promise<ActionResult<{ drafted: number; failed: number }>> {
  return runAction(async () => {
    const p = z.object({ limit: z.number().int().min(1).max(5).default(3) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    if (!isAiConfigured()) throw new Error("AI_NOT_CONFIGURED");
    const user = await requireUser();

    const queued = await db.magazinePost.findMany({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
      take: p.data.limit,
      select: { id: true, title: true, category: true, kind: true, seed: true }
    });

    let drafted = 0;
    let failed = 0;
    const meta = await requestMeta();
    for (const post of queued) {
      try {
        const draft = await generateMagazineDraft({ title: post.title, kind: post.kind, category: post.category, seed: post.seed });
        if (!draft.summary && draft.sections.length === 0) throw new Error("AI_EMPTY");
        const markdown = buildMagazineMarkdown(draft);
        await db.$transaction(async (tx) => {
          await tx.magazinePost.update({ where: { id: post.id }, data: { draft: markdown, status: "DRAFTED" } });
          await recordAudit(tx, { actorId: user.id, action: "magazine.draft", targetType: "MagazinePost", targetId: post.id, ...meta });
        });
        drafted++;
      } catch {
        failed++; // 개별 실패는 격리 — 나머지 계속
      }
    }
    revalidatePath("/magazine");
    return { drafted, failed };
  });
}

/** 상태 전이(검토 흐름) — DRAFTED↔REVIEWED, REVIEWED→QUEUED(재작성). PUBLISHED는 발행 액션 전용. */
export async function setMagazineStatus(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const p = z.object({ id: z.string().min(1), status: z.enum(MAGAZINE_STATUSES) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    if (p.data.status === "PUBLISHED") throw new Error("VALIDATION"); // 발행은 별도 액션(후속)
    const post = await db.magazinePost.findUnique({ where: { id: p.data.id }, select: { id: true, status: true, draft: true } });
    if (!post) throw new Error("NOT_FOUND");
    // 초안 없이 검토 완료로 올릴 수 없음
    if (p.data.status === "REVIEWED" && !post.draft) throw new Error("NOTHING_TO_PUBLISH");
    const user = await requireUser();

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.magazinePost.update({ where: { id: p.data.id }, data: { status: p.data.status } });
      await recordAudit(tx, { actorId: user.id, action: "magazine.status", targetType: "MagazinePost", targetId: p.data.id, afterState: { status: p.data.status }, ...meta });
    });
    revalidatePath("/magazine");
  });
}

/**
 * 파이프라인 ③ — 검토 완료(REVIEWED) 글을 워드프레스로 서버 측 발행.
 * 서버(Vercel)는 egress 제한이 없어 커버 이미지 URL을 가져와 대표이미지로 자동 업로드한다.
 * 카테고리는 이름으로 워드프레스 카테고리 ID를 조회해 자동 매핑(있으면).
 */
export async function publishMagazinePost(input: unknown): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const p = z
      .object({ id: z.string().min(1), coverImageUrl: z.string().url().max(1000).optional().nullable() })
      .safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const post = await db.magazinePost.findUnique({
      where: { id: p.data.id },
      select: { id: true, title: true, category: true, kind: true, status: true, draft: true }
    });
    if (!post) throw new Error("NOT_FOUND");
    if (post.status !== "REVIEWED") throw new Error("CLIENT_APPROVAL_REQUIRED"); // 검토 완료 후에만 발행
    if (!post.draft) throw new Error("NOTHING_TO_PUBLISH");
    const user = await requireUser();

    const html = markdownToHtml(stripLeadingTitle(post.draft));
    if (!html.trim()) throw new Error("NOTHING_TO_PUBLISH");

    // 커버 이미지(선택) — 서버가 URL을 가져와 미디어함에 업로드 → 대표이미지.
    // 업로드된 공개 URL(source_url)은 인스타 발행에 재사용한다.
    let featuredMediaId: number | undefined;
    let coverUrl: string | null = p.data.coverImageUrl ?? null;
    if (p.data.coverImageUrl) {
      const media = await wordpressUploadMediaFromUrl(p.data.coverImageUrl, `${post.id}.png`);
      if (!media.ok) throw new Error(media.error.code === "CONFIG_MISSING" ? "WORDPRESS_NOT_CONFIGURED" : "PUBLISH_FAILED");
      featuredMediaId = media.data.id;
      coverUrl = media.data.sourceUrl ?? p.data.coverImageUrl;
    }

    // 카테고리 이름 → 워드프레스 카테고리 ID(있으면)
    const catId = await wordpressFindCategoryId(post.category);

    const result = await wordpressPublish.publish({
      channel: "WORDPRESS",
      title: post.title,
      bodyHtmlOrMarkdown: html,
      featuredMediaId,
      categories: catId ? [catId] : undefined
    });
    if (!result.ok) {
      if (result.error.code === "CONFIG_MISSING") throw new Error("WORDPRESS_NOT_CONFIGURED");
      throw new Error("PUBLISH_FAILED");
    }

    const publishedUrl = result.data.externalUrl ?? null;
    const wpPostId = result.data.externalId ? Number(result.data.externalId) : null;

    // 인스타그램 자동 발행(완전자동) — 공개 커버 이미지가 있고 인스타가 설정된 경우에만.
    // best-effort: 실패해도 워드프레스 발행은 성공으로 처리(감사 로그에만 남김).
    let igMediaId: string | null = null;
    let igPermalink: string | null = null;
    if (coverUrl && instagramConfigured()) {
      const caption = buildInstagramCaption({ title: post.title, category: post.category, kind: post.kind, draft: post.draft });
      const ig = await instagramPublishImage({ imageUrl: coverUrl, caption });
      if (ig.ok) {
        igMediaId = ig.data.id;
        igPermalink = ig.data.permalink ?? null;
      } else {
        console.error("[magazine publish] instagram 자동 발행 실패", ig.error.code, ig.error.message);
      }
    }

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.magazinePost.update({
        where: { id: p.data.id },
        data: {
          status: "PUBLISHED",
          ...(publishedUrl ? { publishedUrl } : {}),
          ...(wpPostId ? { wpPostId } : {}),
          ...(coverUrl ? { coverUrl } : {}),
          ...(igMediaId ? { igMediaId } : {}),
          ...(igPermalink ? { igPermalink } : {})
        }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "magazine.publish",
        targetType: "MagazinePost",
        targetId: p.data.id,
        afterState: { publishedUrl, wpPostId, featured: Boolean(featuredMediaId), instagram: Boolean(igMediaId) },
        ...meta
      });
    });
    revalidatePath("/magazine");
    return { url: publishedUrl ?? "" };
  });
}

/**
 * 인스타그램 단독 발행 — 이미 발행된 글을 인스타에 (재)발행. 자동 발행이 실패했거나
 * 커버 없이 발행한 글을 나중에 이미지와 함께 올릴 때 사용. PUBLISHED 상태만 허용.
 */
export async function publishMagazineToInstagram(input: unknown): Promise<ActionResult<{ permalink: string }>> {
  return runAction(async () => {
    const p = z
      .object({
        id: z.string().min(1),
        imageUrl: z.string().url().max(1000).optional().nullable(),
        caption: z.string().max(2200).optional().nullable()
      })
      .safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    if (!instagramConfigured()) throw new Error("INSTAGRAM_NOT_CONFIGURED");

    const post = await db.magazinePost.findUnique({
      where: { id: p.data.id },
      select: { id: true, title: true, category: true, kind: true, status: true, draft: true, coverUrl: true }
    });
    if (!post) throw new Error("NOT_FOUND");
    if (post.status !== "PUBLISHED") throw new Error("CLIENT_APPROVAL_REQUIRED"); // 발행된 글만 인스타 게시
    const imageUrl = p.data.imageUrl?.trim() || post.coverUrl;
    if (!imageUrl) throw new Error("NOTHING_TO_PUBLISH"); // 인스타는 이미지 필수
    const user = await requireUser();

    const caption = p.data.caption?.trim() || buildInstagramCaption({ title: post.title, category: post.category, kind: post.kind, draft: post.draft });
    const ig = await instagramPublishImage({ imageUrl, caption });
    if (!ig.ok) {
      if (ig.error.code === "CONFIG_MISSING") throw new Error("INSTAGRAM_NOT_CONFIGURED");
      if (ig.error.code === "UNAUTHORIZED") throw new Error("INSTAGRAM_UNAUTHORIZED");
      if (ig.error.code === "INVALID_INPUT") throw new Error("INSTAGRAM_INVALID_IMAGE");
      throw new Error("PUBLISH_FAILED");
    }

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.magazinePost.update({
        where: { id: p.data.id },
        data: { igMediaId: ig.data.id, ...(ig.data.permalink ? { igPermalink: ig.data.permalink } : {}), ...(imageUrl ? { coverUrl: imageUrl } : {}) }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "magazine.instagram",
        targetType: "MagazinePost",
        targetId: p.data.id,
        afterState: { igMediaId: ig.data.id, igPermalink: ig.data.permalink ?? null },
        ...meta
      });
    });
    revalidatePath("/magazine");
    return { permalink: ig.data.permalink ?? "" };
  });
}

export async function deleteMagazinePost(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const post = await db.magazinePost.findUnique({ where: { id: p.data.id }, select: { id: true, status: true } });
    if (!post) throw new Error("NOT_FOUND");
    const user = await requireUser();

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.magazinePost.delete({ where: { id: p.data.id } });
      await recordAudit(tx, { actorId: user.id, action: "magazine.delete", targetType: "MagazinePost", targetId: p.data.id, ...meta });
    });
    revalidatePath("/magazine");
  });
}
