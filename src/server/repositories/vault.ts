import { db } from "@/server/db";

export type VaultFolderItem = { id: string; name: string; fileCount: number };
export type VaultFileItem = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  uploaderName: string | null;
  createdAt: Date;
};

const fileSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  size: true,
  folderId: true,
  createdAt: true,
  uploadedBy: { select: { name: true } }
} as const;

type RawFile = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  createdAt: Date;
  uploadedBy: { name: string } | null;
};
function toItem(f: RawFile): VaultFileItem {
  return { id: f.id, fileName: f.fileName, mimeType: f.mimeType, size: f.size, folderId: f.folderId, uploaderName: f.uploadedBy?.name ?? null, createdAt: f.createdAt };
}

export async function listVaultFolders(): Promise<VaultFolderItem[]> {
  try {
    const folders = await db.vaultFolder.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, _count: { select: { files: { where: { deletedAt: null } } } } }
    });
    return folders.map((f) => ({ id: f.id, name: f.name, fileCount: f._count.files }));
  } catch {
    // 컬럼 미반영 등 → 필터 없이 폴백.
    const folders = await db.vaultFolder.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, _count: { select: { files: true } } } }).catch(() => []);
    return folders.map((f) => ({ id: f.id, name: f.name, fileCount: f._count.files }));
  }
}

/** folderId=null 이면 미분류(루트) 파일. 휴지통(deletedAt≠null) 제외. */
export async function listVaultFiles(folderId: string | null): Promise<VaultFileItem[]> {
  try {
    const files = await db.storedFile.findMany({ where: { folderId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 200, select: fileSelect });
    return files.map(toItem);
  } catch {
    const files = await db.storedFile.findMany({ where: { folderId }, orderBy: { createdAt: "desc" }, take: 200, select: fileSelect }).catch(() => []);
    return files.map(toItem);
  }
}

/** 휴지통 파일(관리자 열람). */
export async function listVaultTrash(): Promise<VaultFileItem[]> {
  try {
    const files = await db.storedFile.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" }, take: 200, select: fileSelect });
    return files.map(toItem);
  } catch {
    return [];
  }
}

export async function countRootVaultFiles(): Promise<number> {
  try {
    return await db.storedFile.count({ where: { folderId: null, deletedAt: null } });
  } catch {
    return db.storedFile.count({ where: { folderId: null } }).catch(() => 0);
  }
}
