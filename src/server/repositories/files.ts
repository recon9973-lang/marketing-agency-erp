import { db } from "@/server/db";
import { persistBytes } from "@/server/storage";

/**
 * 파일 저장 계층 (워크플로우 3차 · 12차 저장 드라이버 도입).
 *
 * 파일 바이트는 STORAGE_DRIVER(기본 db → blob/nas)에 따라 저장된다.
 * 이 모듈은 메타데이터 CRUD와 접근 제어만 담당하고, 실제 바이트 저장/조회는
 * `@/server/storage` 드라이버가 맡는다(파일당 4MB 제한).
 */

export const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

/** 저장소 key: 사람이 봐도 알아볼 수 있게 prefix + 파일명 정규화. */
function storageKey(prefix: string, fileName: string) {
  const safe = fileName.replace(/[^\w.\-가-힣]+/g, "_").slice(0, 80) || "file";
  return `${prefix}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${safe}`;
}

export { storageKey };

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
  const persisted = await persistBytes({
    key: storageKey("chat", input.fileName),
    data: input.data,
    mimeType: input.mimeType
  });

  const file = await db.storedFile.create({
    data: {
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.data.byteLength,
      data: persisted.inline ? new Uint8Array(persisted.inline) : null,
      storageDriver: persisted.storageDriver,
      storageRef: persisted.storageRef,
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
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      size: true,
      data: true,
      storageDriver: true,
      storageRef: true,
      uploadedById: true,
      inVault: true
    }
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
