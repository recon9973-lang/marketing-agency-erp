// 디자인 스튜디오 에셋 저장소 — 백엔드 무관 추상화.
// 업로드 바이트를 S3(설정 시) 또는 StoredFile(DB BYTEA, 폴백)에 저장하고,
// 에디터가 참조할 안정적인 서빙 URL(/api/studio/assets/{id})을 위한 레코드를 만든다.
// 프로젝트 JSON에는 이 URL만 들어가므로(데이터 URL 인라인 제거) 문서가 가벼워진다.
import { db } from "@/server/db";
import { isS3Configured } from "@/server/storage/s3";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg"
};

export type PutAssetInput = {
  bytes: Buffer;
  mime: string;
  orgId: string;
  ownerId: string;
  width?: number | null;
  height?: number | null;
  kind?: string;
};

export type StudioAsset = {
  id: string;
  url: string; // 에디터/브라우저가 쓰는 접근 URL(백엔드 무관)
  width: number | null;
  height: number | null;
  mimeType: string;
};

/** 에셋을 저장하고 서빙 URL을 포함한 레코드를 반환. S3 미설정 시 DB 폴백. */
export async function putAsset(input: PutAssetInput): Promise<StudioAsset> {
  const ext = EXT_BY_MIME[input.mime] ?? "bin";
  const useS3 = isS3Configured();

  let backend: "s3" | "db";
  let storageKey: string;

  if (useS3) {
    // S3: 먼저 레코드 없이 키를 정하려면 id가 필요 → 레코드 생성 후 키 확정.
    const created = await db.uploadedAsset.create({
      data: {
        orgId: input.orgId,
        ownerId: input.ownerId,
        backend: "s3",
        storageKey: "", // 아래에서 채움
        mimeType: input.mime,
        width: input.width ?? null,
        height: input.height ?? null,
        size: input.bytes.byteLength,
        kind: input.kind ?? "image"
      },
      select: { id: true }
    });
    const key = `studio/${input.orgId}/${created.id}.${ext}`;
    const { s3Put } = await import("@/server/storage/s3");
    await s3Put(key, input.bytes, input.mime);
    await db.uploadedAsset.update({ where: { id: created.id }, data: { storageKey: key } });
    backend = "s3";
    storageKey = key;
    return {
      id: created.id,
      url: `/api/studio/assets/${created.id}`,
      width: input.width ?? null,
      height: input.height ?? null,
      mimeType: input.mime
    };
  }

  // DB 폴백: StoredFile에 바이트 저장 → storageKey = StoredFile id.
  // Prisma Bytes는 Uint8Array<ArrayBuffer>를 요구 → 구체 버퍼로 복사해 타입 정합.
  const view = new Uint8Array(input.bytes.byteLength);
  view.set(input.bytes);
  const stored = await db.storedFile.create({
    data: {
      fileName: `studio-asset.${ext}`,
      mimeType: input.mime,
      size: view.byteLength,
      data: view,
      uploadedById: input.ownerId
    },
    select: { id: true }
  });
  backend = "db";
  storageKey = stored.id;

  const asset = await db.uploadedAsset.create({
    data: {
      orgId: input.orgId,
      ownerId: input.ownerId,
      backend,
      storageKey,
      mimeType: input.mime,
      width: input.width ?? null,
      height: input.height ?? null,
      size: input.bytes.byteLength,
      kind: input.kind ?? "image"
    },
    select: { id: true }
  });
  return {
    id: asset.id,
    url: `/api/studio/assets/${asset.id}`,
    width: input.width ?? null,
    height: input.height ?? null,
    mimeType: input.mime
  };
}

export type ResolvedAsset =
  | { kind: "bytes"; bytes: Uint8Array; mimeType: string }
  | { kind: "redirect"; url: string }
  | { kind: "not_found" };

/** 서빙 라우트가 사용할 해석 — DB면 바이트, S3면 서명 URL로 리다이렉트. */
export async function resolveAsset(orgId: string, id: string): Promise<ResolvedAsset> {
  const asset = await db.uploadedAsset.findUnique({ where: { id } });
  if (!asset || asset.orgId !== orgId) return { kind: "not_found" };

  if (asset.backend === "s3") {
    const { s3SignedGetUrl } = await import("@/server/storage/s3");
    const url = await s3SignedGetUrl(asset.storageKey);
    return { kind: "redirect", url };
  }

  const file = await db.storedFile.findUnique({ where: { id: asset.storageKey } });
  if (!file) return { kind: "not_found" };
  return { kind: "bytes", bytes: new Uint8Array(file.data), mimeType: file.mimeType };
}
