import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireStaff } from "../../guard";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await params;
  const row = await db.journeymapProject.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ id: row.id, updatedAt: row.updatedAt.getTime(), data: row.data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireStaff();
  if (denied) return denied;
  const { id } = await params;
  try {
    await db.journeymapProject.delete({ where: { id } });
  } catch {
    // 이미 없으면 성공으로 간주 (삭제 목적 달성)
  }
  return NextResponse.json({ ok: true });
}
