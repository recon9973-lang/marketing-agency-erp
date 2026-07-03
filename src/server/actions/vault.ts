"use server";

/**
 * 보관함(공용 파일함) server action (워크플로우 5차).
 *
 * 권한 정책:
 * - 폴더 생성/삭제: 최고관리자(SUPER_ADMIN)만 가능.
 * - 파일 업로드/삭제/이동: 로그인한 직원 누구나 가능("일반 파일 자체는 누구나 삭제 가능").
 */
import { revalidatePath } from "next/cache";
import { Role } from "@/domain/types";
import {
  createVaultFolderSchema,
  deleteVaultFileSchema,
  deleteVaultFolderSchema,
  moveVaultFileSchema
} from "@/domain/vault";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireCurrentUser, requireRole } from "@/server/authorization";
import { notFound, validationError } from "@/server/errors";
import { MAX_FILE_SIZE } from "@/server/repositories/files";
import {
  createVaultFile,
  createVaultFolder,
  deleteVaultFile,
  deleteVaultFolder,
  findVaultFolder,
  moveVaultFile
} from "@/server/repositories/vault";

function formDataToObject(formData: FormData) {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      record[key] = value;
    }
  }
  return record;
}

export type VaultFolderActionState = ActionResult<{ folderId: string }>;
export type VaultFileActionState = ActionResult<{ id: string }>;
export type VaultActionState = ActionResult<{ ok: true }>;

/** 폴더 생성 — 최고관리자 전용. */
export async function createVaultFolderAction(
  _prevState: VaultFolderActionState | null,
  formData: FormData
): Promise<VaultFolderActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    requireRole(user, [Role.SUPER_ADMIN]);

    const { name } = createVaultFolderSchema.parse(formDataToObject(formData));
    const folder = await createVaultFolder(name, user.id);

    revalidatePath("/vault");
    return { folderId: folder.id };
  });
}

/** 폴더 삭제 — 최고관리자 전용. 폴더 안 파일은 미분류로 이동한다. */
export async function deleteVaultFolderAction(
  _prevState: VaultActionState | null,
  formData: FormData
): Promise<VaultActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();
    requireRole(user, [Role.SUPER_ADMIN]);

    const { folderId } = deleteVaultFolderSchema.parse(formDataToObject(formData));

    const folder = await findVaultFolder(folderId);
    if (!folder) {
      throw notFound("삭제할 폴더를 찾을 수 없습니다.");
    }

    await deleteVaultFolder(folderId);

    revalidatePath("/vault");
    return { ok: true };
  });
}

/** 파일 업로드 — 누구나 가능. folderId가 비어 있으면 미분류(루트)로 올린다. */
export async function uploadVaultFileAction(
  _prevState: VaultFileActionState | null,
  formData: FormData
): Promise<VaultFileActionState> {
  return runAction(async () => {
    const user = await requireCurrentUser();

    const upload = formData.get("file") as File | string | null;
    const hasFile =
      typeof upload === "object" &&
      upload !== null &&
      typeof upload.arrayBuffer === "function" &&
      upload.size > 0;

    if (!hasFile) {
      throw validationError("업로드할 파일을 선택해주세요.", {
        file: ["업로드할 파일을 선택해주세요."]
      });
    }

    if (upload.size > MAX_FILE_SIZE) {
      throw validationError("파일은 4MB 이하만 올릴 수 있습니다.", {
        file: ["파일은 4MB 이하만 올릴 수 있습니다."]
      });
    }

    const rawFolderId = formData.get("folderId");
    let folderId: string | null = typeof rawFolderId === "string" && rawFolderId ? rawFolderId : null;

    if (folderId) {
      const folder = await findVaultFolder(folderId);
      if (!folder) {
        // 폴더가 사라졌으면 미분류로 올린다.
        folderId = null;
      }
    }

    const stored = await createVaultFile({
      fileName: upload.name || "첨부파일",
      mimeType: upload.type || "application/octet-stream",
      data: new Uint8Array(await upload.arrayBuffer()),
      uploadedById: user.id,
      folderId
    });

    revalidatePath("/vault");
    return { id: stored.id };
  });
}

/** 파일 삭제 — 누구나 가능. */
export async function deleteVaultFileAction(
  _prevState: VaultActionState | null,
  formData: FormData
): Promise<VaultActionState> {
  return runAction(async () => {
    await requireCurrentUser();

    const { fileId } = deleteVaultFileSchema.parse(formDataToObject(formData));
    const removed = await deleteVaultFile(fileId);

    if (removed === 0) {
      throw notFound("삭제할 파일을 찾을 수 없습니다.");
    }

    revalidatePath("/vault");
    return { ok: true };
  });
}

/** 파일 이동(폴더 변경) — 누구나 가능. */
export async function moveVaultFileAction(
  _prevState: VaultActionState | null,
  formData: FormData
): Promise<VaultActionState> {
  return runAction(async () => {
    await requireCurrentUser();

    const { fileId, folderId } = moveVaultFileSchema.parse(formDataToObject(formData));

    if (folderId) {
      const folder = await findVaultFolder(folderId);
      if (!folder) {
        throw notFound("옮길 폴더를 찾을 수 없습니다.");
      }
    }

    const moved = await moveVaultFile(fileId, folderId);
    if (moved === 0) {
      throw notFound("이동할 파일을 찾을 수 없습니다.");
    }

    revalidatePath("/vault");
    return { ok: true };
  });
}
