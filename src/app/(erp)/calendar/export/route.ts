// 자체 캘린더 · .ics 내보내기 — GET. 로그인 사용자의 일정(스코프 내, [-30d,+180d])을
// 표준 iCalendar로 첨부 응답. 구글·애플·아웃룩에서 구독/가져오기 가능.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/session";
import { fetchCalendarEventsForExport } from "@/server/repositories/calendar";
import { buildIcs } from "@/server/calendar/ics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const now = new Date();
  const events = await fetchCalendarEventsForExport(user, now);
  const ics = buildIcs(events, { calName: `VENOM 일정 · ${user.name}`, now });

  const filename = `venom-calendar-${now.toISOString().slice(0, 10)}.ics`;
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}
