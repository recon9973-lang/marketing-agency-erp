import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";

// 보관함 파일 다운로드 — 로그인 필요. DB에 저장된 바이트를 그대로 내려준다.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const file = await db.storedFile.findUnique({ where: { id } });
  if (!file) return new NextResponse("Not found", { status: 404 });

  const body = new Uint8Array(file.data) as unknown as BodyInit;
  return new NextResponse(body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Content-Length": String(file.size),
      "Cache-Control": "private, no-store"
    }
  });
}
