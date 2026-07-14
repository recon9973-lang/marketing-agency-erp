import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";

// 보관함 파일 다운로드 — 로그인 필요. DB에 저장된 바이트를 그대로 내려준다.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const file = await db.storedFile.findUnique({ where: { id } });
  if (!file) return new NextResponse("Not found", { status: 404 });

  // ?preview=1 (이미지 한정) → inline 표시 + 캐시 허용(썸네일용). 그 외엔 첨부 다운로드.
  const preview = new URL(req.url).searchParams.get("preview") === "1";
  const isImage = file.mimeType.startsWith("image/");
  const inline = preview && isImage;

  const body = new Uint8Array(file.data) as unknown as BodyInit;
  return new NextResponse(body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": inline
        ? "inline"
        : `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Content-Length": String(file.size),
      // 썸네일은 잠깐 캐시(재렌더 시 재다운로드 방지), 다운로드는 캐시 금지.
      "Cache-Control": inline ? "private, max-age=3600" : "private, no-store"
    }
  });
}
