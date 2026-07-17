// 목표 경로: src/server/actions/magazine.ts
//
// GROUND 매거진 콘텐츠 트랙 액션 — 용어 큐 대량 등록 / 삭제.
// 자사 미디어라 의료법·거래처 승인 게이트가 없다. 사람 검토 게이트(상태 흐름)만 유지.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buildMagazineMarkdown, isMagazineCategory, isMagazineKind, MAGAZINE_STATUSES, parseMagazineTerms } from "@/domain/content/magazine";
import { db } from "@/server/db";
import { generateMagazineDraft, isAiConfigured } from "@/server/ai/claude";
import { markdownToHtml } from "@/server/marketing/render-plan";
import { wordpressPublish, wordpressUploadMediaFromUrl, wordpressUploadMediaBytes, wordpressFindCategoryId } from "@/server/marketing/providers/wordpress";
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
    // 발행/예약은 별도 액션(publishMagazinePost) 전용 — 상태 전이로 직접 설정 불가.
    if (p.data.status === "PUBLISHED" || p.data.status === "SCHEDULED") throw new Error("VALIDATION");
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

// data:image/(png|jpeg|webp);base64,.... 형태만 허용(브라우저 Canvas 커버). 그 외엔 null.
const COVER_DATAURL_RE = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/;

const publishSchema = z.object({
  id: z.string().min(1),
  // 직접 입력 이미지 URL(선택) — 서버가 받아 업로드.
  coverImageUrl: z.string().url().max(1000).optional().nullable(),
  // 자동 생성 커버(브라우저 Canvas) — data URL(base64). URL과 함께 오면 URL 우선.
  coverDataUrl: z.string().max(8_000_000).optional().nullable(),
  // 예약 발행 시각(ISO). 미래면 워드프레스 future 예약, 과거/없으면 즉시 발행.
  scheduledAt: z.string().datetime({ offset: true }).optional().nullable()
});

/**
 * 파이프라인 ③ — 검토 완료(REVIEWED) 글을 워드프레스로 서버 측 발행.
 * 서버(Vercel)는 egress 제한이 없어 커버 이미지(URL 또는 Canvas 자동생성)를 대표이미지로 자동 업로드한다.
 * scheduledAt(미래)이면 워드프레스 future로 예약 발행(SCHEDULED), 없으면 즉시 발행(PUBLISHED).
 * 카테고리는 이름으로 워드프레스 카테고리 ID를 조회해 자동 매핑(있으면).
 */
export async function publishMagazinePost(input: unknown): Promise<ActionResult<{ url: string; scheduled: boolean }>> {
  return runAction(async () => {
    const p = publishSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const post = await db.magazinePost.findUnique({
      where: { id: p.data.id },
      select: { id: true, title: true, category: true, status: true, draft: true }
    });
    if (!post) throw new Error("NOT_FOUND");
    if (post.status !== "REVIEWED") throw new Error("CLIENT_APPROVAL_REQUIRED"); // 검토 완료 후에만 발행
    if (!post.draft) throw new Error("NOTHING_TO_PUBLISH");
    const user = await requireUser();

    const html = markdownToHtml(stripLeadingTitle(post.draft));
    if (!html.trim()) throw new Error("NOTHING_TO_PUBLISH");

    // 예약 여부 — 미래 시각이면 예약, 그 외엔 즉시.
    const scheduledIso = p.data.scheduledAt ?? null;
    const scheduled = !!scheduledIso && new Date(scheduledIso).getTime() > Date.now();

    // 커버 대표이미지: ① 직접 URL 우선 → ② Canvas data URL. 서버가 미디어함에 업로드.
    let featuredMediaId: number | undefined;
    let coverSourceUrl: string | null = null;
    if (p.data.coverImageUrl) {
      const media = await wordpressUploadMediaFromUrl(p.data.coverImageUrl, `${post.id}.png`);
      if (!media.ok) throw new Error(media.error.code === "CONFIG_MISSING" ? "WORDPRESS_NOT_CONFIGURED" : "PUBLISH_FAILED");
      featuredMediaId = media.data.id;
      coverSourceUrl = media.data.sourceUrl ?? p.data.coverImageUrl;
    } else if (p.data.coverDataUrl) {
      const m = COVER_DATAURL_RE.exec(p.data.coverDataUrl);
      if (!m) throw new Error("VALIDATION");
      const buf = Buffer.from(m[2], "base64");
      if (buf.length === 0 || buf.length > 8_000_000) throw new Error("VALIDATION");
      const ext = m[1] === "image/png" ? "png" : m[1] === "image/webp" ? "webp" : "jpg";
      const media = await wordpressUploadMediaBytes(buf, m[1], `${post.id}.${ext}`);
      if (!media.ok) throw new Error(media.error.code === "CONFIG_MISSING" ? "WORDPRESS_NOT_CONFIGURED" : "PUBLISH_FAILED");
      featuredMediaId = media.data.id;
      coverSourceUrl = media.data.sourceUrl ?? null;
    }

    // 카테고리 이름 → 워드프레스 카테고리 ID(있으면)
    const catId = await wordpressFindCategoryId(post.category);

    const result = await wordpressPublish.publish({
      channel: "WORDPRESS",
      title: post.title,
      bodyHtmlOrMarkdown: html,
      scheduledAt: scheduled ? scheduledIso! : undefined,
      featuredMediaId,
      categories: catId ? [catId] : undefined
    });
    if (!result.ok) {
      if (result.error.code === "CONFIG_MISSING") throw new Error("WORDPRESS_NOT_CONFIGURED");
      throw new Error("PUBLISH_FAILED");
    }

    const publishedUrl = result.data.externalUrl ?? null;
    const wpPostId = result.data.externalId ? Number(result.data.externalId) : null;

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.magazinePost.update({
        where: { id: p.data.id },
        data: {
          status: scheduled ? "SCHEDULED" : "PUBLISHED",
          scheduledAt: scheduled ? new Date(scheduledIso!) : null,
          ...(publishedUrl ? { publishedUrl } : {}),
          ...(wpPostId ? { wpPostId } : {}),
          ...(coverSourceUrl ? { coverUrl: coverSourceUrl } : {})
        }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: scheduled ? "magazine.schedule" : "magazine.publish",
        targetType: "MagazinePost",
        targetId: p.data.id,
        afterState: { publishedUrl, wpPostId, featured: Boolean(featuredMediaId), scheduledAt: scheduled ? scheduledIso : null },
        ...meta
      });
    });
    revalidatePath("/magazine");
    return { url: publishedUrl ?? "", scheduled };
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
