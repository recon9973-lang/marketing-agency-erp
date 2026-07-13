// S3 호환 오브젝트 스토리지 클라이언트 — 디자인 스튜디오 에셋용.
// AWS S3 / Cloudflare R2 / MinIO 등 S3 호환 엔드포인트를 지원한다.
// env 미설정 시 isS3Configured()가 false → assets.ts가 DB(StoredFile) 폴백을 쓴다.
//
// 이 모듈은 assets.ts에서 S3가 설정된 경우에만 동적 import 되므로, 미설정 배포에서는
// AWS SDK가 서버 번들 평가 경로에 들어가지 않는다.
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type S3Env = {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string; // R2/MinIO 등 커스텀 엔드포인트(선택)
  forcePathStyle: boolean;
};

function readEnv(): S3Env | null {
  const bucket = process.env.STUDIO_S3_BUCKET;
  const accessKeyId = process.env.STUDIO_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STUDIO_S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    region: process.env.STUDIO_S3_REGION || "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint: process.env.STUDIO_S3_ENDPOINT || undefined,
    // 커스텀 엔드포인트(R2/MinIO)는 보통 path-style이 안전.
    forcePathStyle: (process.env.STUDIO_S3_FORCE_PATH_STYLE ?? (process.env.STUDIO_S3_ENDPOINT ? "true" : "false")) === "true"
  };
}

/** S3 자격증명·버킷이 모두 설정되어 있는지. 서버 전용. */
export function isS3Configured(): boolean {
  return readEnv() !== null;
}

let cached: { client: S3Client; env: S3Env } | null = null;
function getClient(): { client: S3Client; env: S3Env } {
  if (cached) return cached;
  const env = readEnv();
  if (!env) throw new Error("S3_NOT_CONFIGURED");
  const client = new S3Client({
    region: env.region,
    endpoint: env.endpoint,
    forcePathStyle: env.forcePathStyle,
    credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey }
  });
  cached = { client, env };
  return cached;
}

export async function s3Put(key: string, body: Buffer, contentType: string): Promise<void> {
  const { client, env } = getClient();
  await client.send(
    new PutObjectCommand({ Bucket: env.bucket, Key: key, Body: body, ContentType: contentType })
  );
}

/** 브라우저가 직접 GET 할 짧은 수명의 서명 URL. 공개 CDN base가 있으면 그걸 우선. */
export async function s3SignedGetUrl(key: string, expiresIn = 3600): Promise<string> {
  const publicBase = process.env.STUDIO_S3_PUBLIC_BASE_URL;
  if (publicBase) return `${publicBase.replace(/\/$/, "")}/${key}`;
  const { client, env } = getClient();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: env.bucket, Key: key }), { expiresIn });
}

export async function s3Delete(key: string): Promise<void> {
  const { client, env } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: env.bucket, Key: key }));
}
