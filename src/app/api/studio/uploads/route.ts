// 디자인 스튜디오 이미지 업로드 — 멀티파트 수신 → 에셋 저장소(S3/DB) → 서빙 URL 반환.
// 클라이언트는 응답 url을 이미지 요소 src로 사용한다(데이터 URL 인라인 대체).
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/session";
import { getDefaultOrgId } from "@/server/org";
import { putAsset } from "@/server/storage/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE = 12 * 1024 * 1024; // 12MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "업로드 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "파일이 없습니다." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: "파일이 너무 큽니다(최대 12MB)." }, { status: 413 });
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ ok: false, error: "지원하지 않는 이미지 형식입니다." }, { status: 415 });
  }

  const width = Number(form.get("width")) || null;
  const height = Number(form.get("height")) || null;

  try {
    const orgId = await getDefaultOrgId();
    const bytes = Buffer.from(await file.arrayBuffer());
    const asset = await putAsset({ bytes, mime, orgId, ownerId: user.id, width, height });
    return NextResponse.json({ ok: true, asset });
  } catch (err) {
    console.error("[studio/uploads] 실패:", err);
    return NextResponse.json({ ok: false, error: "업로드에 실패했습니다." }, { status: 500 });
  }
}
