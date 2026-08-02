import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireStaff } from "../../guard";

export const dynamic = "force-dynamic";

// GET /api/journeymap/paa/snapshots?query= — 스냅샷 목록 (result 본문 제외한 요약)
export async function GET(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;
  const query = req.nextUrl.searchParams.get("query")?.trim();
  const snapshots = await db.paaSnapshot.findMany({
    where: query ? { query } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      query: true,
      region: true,
      topic: true,
      advertiser: true,
      rawCount: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ snapshots });
}
