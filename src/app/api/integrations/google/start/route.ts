// 목표 경로: src/app/api/integrations/google/start/route.ts
//
// 거래처별 구글 연결 시작 — 로그인 직원만. state에 {clientId, userId}를 암호화해
// 콜백에서 복원한다(CSRF·변조 방지: AES-256-GCM 인증 암호화).
import { NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthUrl, isGoogleConfigured } from "@/server/integrations/google";
import { encryptSecret } from "@/server/crypto";
import { getCurrentUser } from "@/server/session";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/integrations?error=google_not_configured", req.url));
  }

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ ok: false, error: "MISSING_CLIENT" }, { status: 400 });
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const state = encryptSecret(JSON.stringify({ clientId, userId: user.id, ts: Date.now() }));
  if (!state) return NextResponse.json({ ok: false, error: "STATE_FAILED" }, { status: 500 });

  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
