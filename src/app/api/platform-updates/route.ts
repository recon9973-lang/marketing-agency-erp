// 대시보드 배너용 최근 공지 조회(인앱, 세션 인증).
// 배너 클라이언트가 짧은 주기로 폴링해 새 공지를 새로고침 없이 반영한다(near-real-time).
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/session";
import { listRecentPlatformUpdates } from "@/server/repositories/platform-updates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  try {
    const updates = await listRecentPlatformUpdates(20);
    return NextResponse.json(
      { ok: true, updates, serverTime: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    console.error("[api/platform-updates] list failed", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
