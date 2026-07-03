import { db } from "@/server/db";

/**
 * 보관함(공용 파일함) 저장 계층 (워크플로우 5차).
 *
 * 파일 바이트는 채팅 첨부와 동일하게 StoredFile(bytea)에 저장하되,
 * inVault=true 플래그로 보관함 소속임을 구분하고 folderId로 폴더에 담는다.
 * Blob/NAS로 옮길 때는 파일 계층(files.ts)만 교체하면 된다.
 */

export type VaultFolderItem = {
  id: string;
  name: string;
  fileCount: number;
  createdAt: Date;
};

export type VaultFileItem = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  uploaderName: string | null;
  createdAt: Date;
};

/** 보관함 폴더 목록(이름 순, 파일 수 포함). */
export async function listVaultFolders(): Promise<VaultFolderItem[]> {
  const folders = await db.vaultFolder.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { files: true } }
    }
  });

  return folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    fileCount: folder._count.files,
    createdAt: folder.createdAt
  }));
}

/** 보관함 파일 목록(최근 업로드 순). */
export async function listVaultFiles(): Promise<VaultFileItem[]> {
  const files = await db.storedFile.findMany({
    where: { inVault: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      size: true,
      folderId: true,
      createdAt: true,
      uploadedBy: { select: { name: true } }
    }
  });

  return files.map((file) => ({
    id: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    size: file.size,
    folderId: file.folderId,
    uploaderName: file.uploadedBy?.name ?? null,
    createdAt: file.createdAt
  }));
}

/** 보관함 폴더 생성. */
export async function createVaultFolder(name: string, createdById: string): Promise<{ id: string }> {
  const folder = await db.vaultFolder.create({
    data: { name, createdById },
    select: { id: true }
  });

  return folder;
}

export async function findVaultFolder(folderId: string) {
  return db.vaultFolder.findUnique({ where: { id: folderId }, select: { id: true } });
}

/**
 * 보관함 폴더 삭제. 폴더 안의 파일은 지우지 않고 미분류(루트)로 옮긴다.
 * 실수로 삭제해도 파일 자체는 보존되도록 하기 위함이다.
 */
export async function deleteVaultFolder(folderId: string): Promise<void> {
  await db.$transaction([
    db.storedFile.updateMany({ where: { folderId }, data: { folderId: null } }),
    db.vaultFolder.delete({ where: { id: folderId } })
  ]);
}

/** 보관함에 파일 저장. */
export async function createVaultFile(input: {
  fileName: string;
  mimeType: string;
  data: Uint8Array;
  uploadedById: string;
  folderId: string | null;
}): Promise<{ id: string }> {
  const file = await db.storedFile.create({
    data: {
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.data.byteLength,
      data: new Uint8Array(input.data),
      uploadedById: input.uploadedById,
      inVault: true,
      folderId: input.folderId
    },
    select: { id: true }
  });

  return file;
}

/** 보관함 파일 삭제(누구나 가능). 채팅 첨부 파일은 지우지 않도록 inVault로 제한한다. */
export async function deleteVaultFile(fileId: string): Promise<number> {
  const result = await db.storedFile.deleteMany({ where: { id: fileId, inVault: true } });
  return result.count;
}

/** 보관함 파일을 다른 폴더(또는 미분류)로 이동. */
export async function moveVaultFile(fileId: string, folderId: string | null): Promise<number> {
  const result = await db.storedFile.updateMany({
    where: { id: fileId, inVault: true },
    data: { folderId }
  });
  return result.count;
}
