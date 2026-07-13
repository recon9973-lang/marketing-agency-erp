// 플랫폼 공지 자동 수집 크론 진입점 — near-real-time(vercel.json, 기본 3시간).
// Vercel Cron이 Authorization: Bearer <CRON_SECRET> 를 붙여 호출한다.
import { NextRequest, NextResponse } from "next/server";
import { runPlatformUpdatesSync } from "@/server/jobs/platform-updates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await runPlatformUpdatesSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[platform-updates/cron] sync failed", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
