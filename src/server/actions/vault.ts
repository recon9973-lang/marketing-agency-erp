// 보관함(공용 파일함) server action.
// 권한: 폴더 생성/삭제 = 누구나. 파일 업로드 = 누구나. 파일 삭제 = 휴지통으로(누구나).
//       휴지통 복원·영구삭제 = 관리자 이상.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role } from "@/domain/types";
import { db } from "@/server/db";
import { recordAudit, requestMeta, requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";

// ⚠️ "use server" 파일은 async 함수만 export 가능(Next 15.5+ 엄격 검증).
//    상수는 절대 export하지 말 것 — 클라이언트가 이 파일을 import하는 순간 빌드/런타임에서 터진다.
const MAX_VAULT_FILE_SIZE = 8 * 1024 * 1024; // 8MB

// 휴지통 컬럼 자가치유(마이그레이션 지연 대비·멱등).
async function ensureTrashCol(): Promise<void> {
  try {
    await db.$executeRawUnsafe(`ALTER TABLE "StoredFile" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`);
  } catch (e) {
    console.warn("[vault] deletedAt 컬럼 보장 실패(무시):", String(e).slice(0, 140));
  }
}

export async function createVaultFolder(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
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

export async function deleteVaultFile(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser(); // 누구나 삭제 → 휴지통으로(소프트 삭제)
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await ensureTrashCol();
    await db.storedFile.update({ where: { id: p.data.id }, data: { deletedAt: new Date() } });
    revalidatePath("/vault");
  });
}

/** 휴지통 복원 — 관리자 이상. */
export async function restoreVaultFile(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) throw new Error("FORBIDDEN");
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await ensureTrashCol();
    await db.storedFile.update({ where: { id: p.data.id }, data: { deletedAt: null } });
    revalidatePath("/vault");
  });
}

/** 휴지통 영구 삭제 — 관리자 이상. */
export async function purgeVaultFile(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) throw new Error("FORBIDDEN");
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await db.storedFile.delete({ where: { id: p.data.id } });
    revalidatePath("/vault");
  });
}
