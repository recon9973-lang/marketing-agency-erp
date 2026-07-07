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

export async function listVaultFolders(): Promise<VaultFolderItem[]> {
  const folders = await db.vaultFolder.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, _count: { select: { files: true } } }
  });
  return folders.map((f) => ({ id: f.id, name: f.name, fileCount: f._count.files }));
}

/** folderId=null 이면 미분류(루트) 파일. */
export async function listVaultFiles(folderId: string | null): Promise<VaultFileItem[]> {
  const files = await db.storedFile.findMany({
    where: { folderId },
    orderBy: { createdAt: "desc" },
    take: 200,
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
  return files.map((f) => ({
    id: f.id,
    fileName: f.fileName,
    mimeType: f.mimeType,
    size: f.size,
    folderId: f.folderId,
    uploaderName: f.uploadedBy?.name ?? null,
    createdAt: f.createdAt
  }));
}

export async function countRootVaultFiles(): Promise<number> {
  return db.storedFile.count({ where: { folderId: null } });
}
