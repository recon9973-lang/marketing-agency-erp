// 디자인 스튜디오 에셋 서빙 — 백엔드 무관. DB면 바이트 인라인, S3면 서명 URL로 307.
// 같은 출처(<img>/Konva)에서 쿠키 인증으로 접근한다. 캔버스 내보내기(toDataURL)를
// 위해 DB 백엔드는 same-origin이라 taint 없음. S3 백엔드는 버킷 CORS 설정 필요.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/session";
import { getDefaultOrgId } from "@/server/org";
import { resolveAsset } from "@/server/storage/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const orgId = await getDefaultOrgId();
  const resolved = await resolveAsset(orgId, id);

  if (resolved.kind === "not_found") return new NextResponse("Not found", { status: 404 });
  if (resolved.kind === "redirect") {
    return NextResponse.redirect(resolved.url, 307);
  }

  const body = resolved.bytes as unknown as BodyInit;
  return new NextResponse(body, {
    headers: {
      "Content-Type": resolved.mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=86400"
    }
  });
}
