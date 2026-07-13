// 디자인 스튜디오 — 프로젝트 생성/저장(자동저장)/이름변경/삭제.
// 규칙: 로그인 사용자 전용, 조직 스코프. 저장 문서는 스키마 검증 후 보관.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";
import { assertProjectAccess } from "@/server/repositories/studio";
import { blankDoc, studioDoc, SIZE_PRESETS, type StudioKind } from "@/domain/studio/schema";
import { getBuiltinTemplate, instantiateTemplateDoc } from "@/domain/studio/templates";
import { autopaginate } from "@/domain/studio/autopaginate";
import type { Prisma } from "@prisma/client";

const createSchema = z.object({
  presetKey: z.string().optional(),
  templateId: z.string().optional(),
  width: z.number().int().min(16).max(8000).optional(),
  height: z.number().int().min(16).max(8000).optional(),
  kind: z.string().optional(),
  title: z.string().max(120).optional()
});

/** 새 프로젝트 생성 후 id 반환. 템플릿 / 프리셋 / 명시 크기 순으로 캔버스·문서 결정. */
export async function createStudioProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const orgId = await getDefaultOrgId();
    const parsed = createSchema.parse(input ?? {});

    const template = parsed.templateId ? getBuiltinTemplate(parsed.templateId) : undefined;
    const preset = parsed.presetKey ? SIZE_PRESETS.find((p) => p.key === parsed.presetKey) : undefined;

    const width = template?.width ?? parsed.width ?? preset?.w ?? 1080;
    const height = template?.height ?? parsed.height ?? preset?.h ?? 1080;
    const kind: StudioKind = (template?.kind as StudioKind) ?? preset?.kind ?? (parsed.kind as StudioKind) ?? "blank";
    const doc = template ? instantiateTemplateDoc(template) : blankDoc(width, height);
    const title = parsed.title?.trim() || (template ? template.title : "제목 없는 디자인");

    const created = await db.studioProject.create({
      data: {
        orgId,
        ownerId: user.id,
        title,
        kind,
        canvasW: width,
        canvasH: height,
        data: doc as unknown as Prisma.InputJsonValue
      },
      select: { id: true }
    });
    revalidatePath("/studio");
    return { id: created.id };
  });
}

const cardnewsSchema = z.object({
  text: z.string().min(1).max(20_000),
  cover: z.boolean().optional(),
  title: z.string().max(120).optional()
});

/** 긴 글 → 카드뉴스 자동 분할. 표지+본문 N장 프로젝트를 만들고 id 반환. */
export async function createStudioCardnews(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const orgId = await getDefaultOrgId();
    const parsed = cardnewsSchema.parse(input);

    const width = 1080;
    const height = 1350;
    const doc = autopaginate(parsed.text, { width, height, cover: parsed.cover ?? true, title: parsed.title });
    // 제목: 지정값 우선, 없으면 본문 첫 줄에서 추출.
    const firstLine = parsed.text.split("\n").map((l) => l.trim()).find(Boolean) ?? "카드뉴스";
    const title = (parsed.title?.trim() || firstLine).slice(0, 60);

    const created = await db.studioProject.create({
      data: {
        orgId,
        ownerId: user.id,
        title,
        kind: "cardnews",
        canvasW: width,
        canvasH: height,
        data: doc as unknown as Prisma.InputJsonValue
      },
      select: { id: true }
    });
    revalidatePath("/studio");
    return { id: created.id };
  });
}

const resizeSchema = z.object({ id: z.string().min(1), presetKey: z.string().min(1) });

/** 멀티사이즈 변환(C4) — 소스 디자인을 다른 사이즈 프리셋으로 contain-스케일·중앙정렬한 새 프로젝트로 복제. */
export async function createStudioResize(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const orgId = await getDefaultOrgId();
    const { id, presetKey } = resizeSchema.parse(input);
    const preset = SIZE_PRESETS.find((p) => p.key === presetKey);
    if (!preset) throw new Error("BAD_PRESET");
    const src = await db.studioProject.findFirst({ where: { id, orgId } });
    if (!src) throw new Error("NOT_FOUND");
    const doc = studioDoc.parse(src.data);

    const pages = doc.pages.map((pg) => {
      const s = Math.min(preset.w / pg.width, preset.h / pg.height);
      const offX = (preset.w - pg.width * s) / 2;
      const offY = (preset.h - pg.height * s) / 2;
      const elements = pg.elements.map((el) => {
        const common = { x: el.x * s + offX, y: el.y * s + offY, width: el.width * s, height: el.height * s };
        if (el.type === "text") return { ...el, ...common, fontSize: Math.max(6, Math.round(el.fontSize * s)) };
        if (el.type === "rect" || el.type === "ellipse") return { ...el, ...common, cornerRadius: Math.round(el.cornerRadius * s), strokeWidth: Math.round(el.strokeWidth * s) };
        return { ...el, ...common, cornerRadius: Math.round(el.cornerRadius * s) };
      });
      return { ...pg, width: preset.w, height: preset.h, elements };
    });
    const newDoc = { ...doc, pages };

    const created = await db.studioProject.create({
      data: {
        orgId,
        ownerId: user.id,
        title: `${src.title} (${preset.label.split(" ")[0]})`,
        kind: preset.kind,
        canvasW: preset.w,
        canvasH: preset.h,
        data: newDoc as unknown as Prisma.InputJsonValue
      },
      select: { id: true }
    });
    revalidatePath("/studio");
    return { id: created.id };
  });
}

const saveSchema = z.object({
  id: z.string(),
  doc: studioDoc,
  thumbnail: z.string().max(400_000).nullable().optional() // 소형 data URL 썸네일(선택)
});

/** 자동저장 — 문서 전체를 검증 후 교체. 대표 크기는 1페이지 기준으로 갱신. */
export async function saveStudioProject(input: unknown): Promise<ActionResult<{ updatedAt: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const orgId = await getDefaultOrgId();
    const parsed = saveSchema.parse(input);
    await assertProjectAccess(user, orgId, parsed.id);

    const first = parsed.doc.pages[0];
    const updated = await db.studioProject.update({
      where: { id: parsed.id },
      data: {
        data: parsed.doc as unknown as Prisma.InputJsonValue,
        canvasW: first.width,
        canvasH: first.height,
        ...(parsed.thumbnail !== undefined ? { thumbnail: parsed.thumbnail } : {})
      },
      select: { updatedAt: true }
    });
    return { updatedAt: updated.updatedAt.toISOString() };
  });
}

const renameSchema = z.object({ id: z.string(), title: z.string().min(1).max(120) });

export async function renameStudioProject(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const orgId = await getDefaultOrgId();
    const parsed = renameSchema.parse(input);
    await assertProjectAccess(user, orgId, parsed.id);
    await db.studioProject.update({ where: { id: parsed.id }, data: { title: parsed.title.trim() } });
    revalidatePath("/studio");
  });
}

export async function deleteStudioProject(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const orgId = await getDefaultOrgId();
    const parsed = z.object({ id: z.string() }).parse(input);
    await assertProjectAccess(user, orgId, parsed.id);
    // 소프트 삭제 — 목록에서 감춤(복구 여지).
    await db.studioProject.update({ where: { id: parsed.id }, data: { status: "ARCHIVED" } });
    revalidatePath("/studio");
  });
}
