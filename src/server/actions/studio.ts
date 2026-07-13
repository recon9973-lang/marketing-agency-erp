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
import type { Prisma } from "@prisma/client";

const createSchema = z.object({
  presetKey: z.string().optional(),
  width: z.number().int().min(16).max(8000).optional(),
  height: z.number().int().min(16).max(8000).optional(),
  kind: z.string().optional(),
  title: z.string().max(120).optional()
});

/** 새 프로젝트 생성 후 id 반환. 프리셋 키 또는 명시 크기 중 하나로 캔버스 지정. */
export async function createStudioProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const orgId = await getDefaultOrgId();
    const parsed = createSchema.parse(input ?? {});

    const preset = parsed.presetKey ? SIZE_PRESETS.find((p) => p.key === parsed.presetKey) : undefined;
    const width = parsed.width ?? preset?.w ?? 1080;
    const height = parsed.height ?? preset?.h ?? 1080;
    const kind: StudioKind = (preset?.kind ?? (parsed.kind as StudioKind)) ?? "blank";

    const created = await db.studioProject.create({
      data: {
        orgId,
        ownerId: user.id,
        title: parsed.title?.trim() || "제목 없는 디자인",
        kind,
        canvasW: width,
        canvasH: height,
        data: blankDoc(width, height) as unknown as Prisma.InputJsonValue
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
