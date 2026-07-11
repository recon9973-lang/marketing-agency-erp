// 경량 워밍 핑 — Neon이 유휴 시 0으로 스케일다운(=다음 쿼리 수초 지연)되는 걸 막는다.
// ERP가 열려 있는 동안 클라이언트가 주기적으로 호출해 DB 컴퓨트를 깨어 있게 유지.
import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    // 실패해도 조용히 — 워밍용이라 사용자 영향 없음.
    return NextResponse.json({ ok: false }, { status: 200, headers: { "cache-control": "no-store" } });
  }
}
