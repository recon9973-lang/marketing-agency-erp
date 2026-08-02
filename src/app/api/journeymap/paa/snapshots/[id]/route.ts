import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireStaff } from "../../../guard";

export const dynamic = "force-dynamic";

// GET /api/journeymap/paa/snapshots/[id] — 스냅샷 1건 (트리 포함)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await params;
  const snapshot = await db.paaSnapshot.findUnique({ where: { id } });
  if (!snapshot) {
    return NextResponse.json({ error: "스냅샷을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({
    snapshotId: snapshot.id,
    createdAt: snapshot.createdAt.toISOString(),
    query: snapshot.query,
    region: snapshot.region,
    topic: snapshot.topic,
    advertiser: snapshot.advertiser,
    rawCount: snapshot.rawCount,
    tree: snapshot.result,
  });
}

// DELETE — 영구 보관 데이터의 유일한 삭제 경로
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await params;
  try {
    await db.paaSnapshot.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "이미 삭제되었거나 없는 스냅샷입니다." }, { status: 404 });
  }
}
