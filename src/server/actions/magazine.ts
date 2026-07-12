// 목표 경로: src/server/actions/magazine.ts
//
// GROUND 매거진 콘텐츠 트랙 액션 — 용어 큐 대량 등록 / 삭제.
// 자사 미디어라 의료법·거래처 승인 게이트가 없다. 사람 검토 게이트(상태 흐름)만 유지.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isMagazineCategory, isMagazineKind, parseMagazineTerms } from "@/domain/content/magazine";
import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import { recordAudit, requestMeta, requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";

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
