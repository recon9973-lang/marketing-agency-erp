import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireStaff } from "../guard";

export const dynamic = "force-dynamic";

// 여정맵 프로젝트 서버 저장 — 브라우저 로컬 저장의 기기별 상이·유실 문제 해결.
// GET: 전체 목록(Project JSON 포함, 최신순) / POST: upsert (마지막 수정 우선 LWW)

export async function GET() {
  const denied = await requireStaff();
  if (denied) return denied;
  const rows = await db.journeymapProject.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({
    projects: rows.map((r) => ({ id: r.id, updatedAt: r.updatedAt.getTime(), data: r.data })),
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;
  try {
    const body = await req.json();
    const p = body.project;
    if (!p || typeof p.id !== "string" || !p.id || typeof p.mainKeyword !== "string") {
      return NextResponse.json({ error: "잘못된 프로젝트 데이터입니다." }, { status: 400 });
    }
    const updatedAt = new Date(typeof p.updatedAt === "number" ? p.updatedAt : Date.now());

    // LWW: 서버에 더 최신 버전이 있으면 덮어쓰지 않는다 (다른 브라우저의 최신 편집 보호)
    const existing = await db.journeymapProject.findUnique({ where: { id: p.id }, select: { updatedAt: true } });
    if (existing && existing.updatedAt.getTime() > updatedAt.getTime()) {
      return NextResponse.json({ ok: true, skipped: "server_newer" });
    }

    await db.journeymapProject.upsert({
      where: { id: p.id },
      update: { mainKeyword: p.mainKeyword, hospital: p.profile?.name ?? "", data: p, updatedAt },
      create: { id: p.id, mainKeyword: p.mainKeyword, hospital: p.profile?.name ?? "", data: p, updatedAt },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("프로젝트 저장 오류:", err);
    return NextResponse.json({ error: "프로젝트 저장에 실패했습니다." }, { status: 500 });
  }
}
