import { NextResponse, type NextRequest } from "next/server";
import { getFileForUser } from "@/server/repositories/files";
import { getCurrentUser } from "@/server/session";

/** 첨부 파일 다운로드. 업로더 본인 또는 첨부된 대화방 멤버만 접근 가능. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { id } = await params;
  const file = await getFileForUser(id, user.id);

  if (!file) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const isImage = file.mimeType.startsWith("image/");
  const body = new Uint8Array(file.data);

  return new NextResponse(body, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${isImage ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, max-age=3600"
    }
  });
}
