// 보관함(공용 파일함) server action.
// 권한: 폴더 생성/삭제 = 최고관리자(SUPER_ADMIN)만. 파일 업로드/삭제 = 로그인한 누구나.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role } from "@/domain/types";
import { db } from "@/server/db";
import { recordAudit, requestMeta, requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";

export const MAX_VAULT_FILE_SIZE = 8 * 1024 * 1024; // 8MB

export async function createVaultFolder(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN) throw new Error("FORBIDDEN");
    const p = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const meta = await requestMeta();
    const folder = await db.$transaction(async (tx) => {
      const created = await tx.vaultFolder.create({ data: { name: p.data.name, createdById: user.id } });
      await recordAudit(tx, { actorId: user.id, action: "vault.folder.create", targetType: "VaultFolder", targetId: created.id, afterState: { name: created.name }, ...meta });
      return created;
    });
    revalidatePath("/vault");
    return { id: folder.id };
  });
}

export async function deleteVaultFolder(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN) throw new Error("FORBIDDEN");
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const folder = await db.vaultFolder.findUnique({ where: { id: p.data.id } });
    if (!folder) throw new Error("NOT_FOUND");
    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      // 폴더 안 파일은 미분류(루트)로 이동 후 폴더 삭제 (파일은 보존).
      await tx.storedFile.updateMany({ where: { folderId: p.data.id }, data: { folderId: null } });
      await tx.vaultFolder.delete({ where: { id: p.data.id } });
      await recordAudit(tx, { actorId: user.id, action: "vault.folder.delete", targetType: "VaultFolder", targetId: p.data.id, beforeState: { name: folder.name }, ...meta });
    });
    revalidatePath("/vault");
  });
}

export async function uploadVaultFile(formData: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("NO_FILE");
    if (file.size > MAX_VAULT_FILE_SIZE) throw new Error("FILE_TOO_LARGE");

    const rawFolder = formData.get("folderId");
    let folderId = typeof rawFolder === "string" && rawFolder ? rawFolder : null;
    if (folderId) {
      const exists = await db.vaultFolder.findUnique({ where: { id: folderId }, select: { id: true } });
      if (!exists) folderId = null; // 폴더가 사라졌으면 미분류로
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const saved = await db.storedFile.create({
      data: {
        fileName: file.name.slice(0, 255),
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        data: bytes,
        uploadedById: user.id,
        folderId
      },
      select: { id: true }
    });
    revalidatePath("/vault");
    return { id: saved.id };
  });
}

export async function moveVaultFile(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser(); // 누구나 정리 가능
    const p = z.object({ id: z.string().min(1), folderId: z.string().min(1).nullable() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    let folderId = p.data.folderId;
    if (folderId) {
      const exists = await db.vaultFolder.findUnique({ where: { id: folderId }, select: { id: true } });
      if (!exists) folderId = null; // 폴더가 사라졌으면 미분류로
    }
    await db.storedFile.update({ where: { id: p.data.id }, data: { folderId } });
    revalidatePath("/vault");
  });
}

export async function deleteVaultFile(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser(); // 누구나 삭제 가능
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await db.storedFile.delete({ where: { id: p.data.id } });
    revalidatePath("/vault");
  });
}
