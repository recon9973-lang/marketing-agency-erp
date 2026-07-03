import { db } from "@/server/db";

/**
 * 파일 저장 계층 (워크플로우 3차).
 *
 * 임시로 DB(bytea)에 저장한다(기획 결정: Blob/NAS 준비 전까지, 파일당 4MB 제한).
 * 저장소를 Vercel Blob/NAS로 옮길 때 이 모듈의 구현만 교체한다.
 */

export const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

export type StoredFileMeta = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export async function createStoredFile(input: {
  fileName: string;
  mimeType: string;
  data: Uint8Array;
  uploadedById: string;
}): Promise<StoredFileMeta> {
  const file = await db.storedFile.create({
    data: {
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.data.byteLength,
      data: new Uint8Array(input.data),
      uploadedById: input.uploadedById
    },
    select: { id: true, fileName: true, mimeType: true, size: true }
  });

  return file;
}

/**
 * 파일 다운로드용 조회. 본인이 올린 파일이거나,
 * 그 파일이 첨부된 대화방의 멤버인 경우에만 반환한다.
 */
export async function getFileForUser(fileId: string, userId: string) {
  const file = await db.storedFile.findUnique({
    where: { id: fileId },
    select: { id: true, fileName: true, mimeType: true, size: true, data: true, uploadedById: true, inVault: true }
  });

  if (!file) {
    return null;
  }

  // 보관함 파일은 공용이므로 로그인한 직원 누구나 내려받을 수 있다.
  if (file.inVault) {
    return file;
  }

  if (file.uploadedById === userId) {
    return file;
  }

  const accessibleMessage = await db.chatMessage.findFirst({
    where: { fileId, room: { members: { some: { userId } } } },
    select: { id: true }
  });

  return accessibleMessage ? file : null;
}
