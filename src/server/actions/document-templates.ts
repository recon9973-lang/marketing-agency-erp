// 목표 경로: src/server/actions/document-templates.ts
//
// 서식(문서 템플릿) 관리 — 추가/수정/삭제. 관리자(ADMIN) 이상만.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role, DocumentCategory } from "@/domain/types";
import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import {
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";

function assertManager(role: Role) {
  if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN) throw new Error("FORBIDDEN");
}

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  category: z.nativeEnum(DocumentCategory),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  minRole: z.nativeEnum(Role).optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional()
});

export async function saveDocumentTemplate(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    assertManager(user.role);
    const p = upsertSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    const meta = await requestMeta();
    const orgId = await getDefaultOrgId();
    const data = {
      name: d.name,
      category: d.category,
      title: d.title,
      body: d.body,
      minRole: d.minRole ?? Role.MARKETER,
      sortOrder: d.sortOrder ?? 0,
      isActive: d.isActive ?? true
    };

    const saved = await db.$transaction(async (tx) => {
      if (d.id) {
        const before = await tx.documentTemplate.findUnique({ where: { id: d.id } });
        if (!before) throw new Error("NOT_FOUND");
        const after = await tx.documentTemplate.update({ where: { id: d.id }, data });
        await recordAudit(tx, { actorId: user.id, action: "documentTemplate.update", targetType: "DocumentTemplate", targetId: after.id, beforeState: before, afterState: after, ...meta });
        return after;
      }
      const created = await tx.documentTemplate.create({ data: { ...data, orgId, createdById: user.id } });
      await recordAudit(tx, { actorId: user.id, action: "documentTemplate.create", targetType: "DocumentTemplate", targetId: created.id, afterState: created, ...meta });
      return created;
    });

    revalidatePath("/settings");
    revalidatePath("/contracts");
    return { id: saved.id };
  });
}

export async function deleteDocumentTemplate(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    assertManager(user.role);
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const before = await db.documentTemplate.findUnique({ where: { id: p.data.id } });
    if (!before) throw new Error("NOT_FOUND");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.documentTemplate.delete({ where: { id: p.data.id } });
      await recordAudit(tx, { actorId: user.id, action: "documentTemplate.delete", targetType: "DocumentTemplate", targetId: p.data.id, beforeState: { name: before.name, category: before.category }, ...meta });
    });

    revalidatePath("/settings");
    revalidatePath("/contracts");
  });
}
