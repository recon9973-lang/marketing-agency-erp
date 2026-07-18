import { redirect } from "next/navigation";
import { CalendarScheduler } from "@/components/calendar/CalendarScheduler";
import { MonthCalendar, type GridEvent } from "@/components/calendar/MonthCalendar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { calendarKindLabels, fetchCalendarEventsForUser, fetchTeamCalendarEvents, type CalendarListItem, type TeamCalendarItem } from "@/server/repositories/calendar";
import { CalendarEventKind, CalendarProvider, ConnectionStatus, Role } from "@/domain/types";
import { db } from "@/server/db";
import { getSchedulerDay } from "@/server/repositories/work";
import { getCurrentUser } from "@/server/session";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });
const timeFormatter = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" });

// 일정 종류별 색상(가독성).
const KIND_TONE: Record<CalendarEventKind, string> = {
  [CalendarEventKind.TASK]: "border-amber-200 bg-amber-50 text-amber-700",
  [CalendarEventKind.CLIENT_MEETING]: "border-sky-200 bg-sky-50 text-sky-700",
  [CalendarEventKind.REPORT_DEADLINE]: "border-violet-200 bg-violet-50 text-violet-700",
  [CalendarEventKind.LEAVE]: "border-emerald-200 bg-emerald-50 text-emerald-700",
  [CalendarEventKind.INTERNAL_INSTRUCTION]: "border-rose-200 bg-rose-50 text-rose-700"
};
function kindBadge(kind: CalendarEventKind) {
  return `rounded-md border px-2 py-0.5 text-[11px] font-semibold ${KIND_TONE[kind]}`;
}

/** 기간 필터: 오늘 기준 이번주(월~일)·이번달 범위. */
function rangeBounds(range: string, now: Date): { start: Date; end: Date } | null {
  if (range === "week") {
    const d = new Date(now);
    const dow = (d.getDay() + 6) % 7; // 월=0
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    return { start, end };
  }
  if (range === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }
  return null; // all
}

function groupByDay(events: CalendarListItem[]) {
  return events.reduce<Record<string, CalendarListItem[]>>((groups, event) => {
    const key = event.startsAt.toISOString().slice(0, 10);
    groups[key] = [...(groups[key] ?? []), event];
    return groups;
  }, {});
}

function groupByOwner(events: TeamCalendarItem[]) {
  return events.reduce<Record<string, TeamCalendarItem[]>>((groups, event) => {
    groups[event.ownerName] = [...(groups[event.ownerName] ?? []), event];
    return groups;
  }, {});
}

function providerLabel(provider: CalendarProvider) {
  if (provider === CalendarProvider.GOOGLE) return "Google";
  if (provider === CalendarProvider.NAVER) return "Naver";
  return "Internal";
}

function EventRow({ event }: { event: CalendarListItem }) {
  return (
    <li className="grid grid-cols-1 gap-3 border-t border-line py-4 md:grid-cols-[9rem_1fr_8rem] md:items-center">
      <div className="text-sm text-slate-500">
        {timeFormatter.format(event.startsAt)} - {timeFormatter.format(event.endsAt)}
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={kindBadge(event.kind)}>{calendarKindLabels[event.kind]}</span>
          <p className="font-medium text-ink">{event.title}</p>
        </div>
        <p className="mt-1 text-sm text-slate-600">{event.clientName ?? event.description ?? "사내 일정"}</p>
      </div>
      <div className="text-sm text-slate-500">{providerLabel(event.provider)}</div>
    </li>
  );
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const range = one(sp.range) ?? "all"; // all | week | month
  const ownerFilter = one(sp.owner) ?? "";

  const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
  const todayKey = dayKeyFormatter.format(new Date());
  const [allEvents, schedulerItems, companySetting, allTeamEvents] = await Promise.all([
    fetchCalendarEventsForUser(user),
    getSchedulerDay(user, user.id, new Date(`${todayKey}T00:00:00`)),
    db.companySetting.findFirst({ select: { workloadDailyMinutes: true } }),
    isManager ? fetchTeamCalendarEvents(user) : Promise.resolve([] as TeamCalendarItem[])
  ]);

  const bounds = rangeBounds(range, new Date());
  const inRange = (d: Date) => !bounds || (d >= bounds.start && d < bounds.end);
  const events = allEvents.filter((e) => inRange(e.startsAt));
  const teamEvents = allTeamEvents.filter((e) => inRange(e.startsAt) && (!ownerFilter || e.ownerName === ownerFilter));

  const owners = [...new Set(allTeamEvents.map((e) => e.ownerName))].sort();
  const rangeQs = (r: string) => `?range=${r}${ownerFilter ? `&owner=${encodeURIComponent(ownerFilter)}` : ""}`;
  const ownerQs = (o: string) => `?range=${range}${o ? `&owner=${encodeURIComponent(o)}` : ""}`;
  const RANGES: [string, string][] = [["all", "전체"], ["week", "이번주"], ["month", "이번달"]];

  const groupedEvents = groupByDay(events);
  const teamByOwner = groupByOwner(teamEvents);

  // 월간 격자 달력 — ?month=YYYY-MM(기본 이번달). 관리자는 팀 전체, 그 외 본인 일정.
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(one(sp.month) ?? "");
  const gridYear = monthMatch ? Number(monthMatch[1]) : Number(todayKey.slice(0, 4));
  const gridMonthIndex = monthMatch ? Number(monthMatch[2]) - 1 : Number(todayKey.slice(5, 7)) - 1;
  const monthPrefix = `${gridYear}-${String(gridMonthIndex + 1).padStart(2, "0")}`;
  const gridSource = isManager ? allTeamEvents : allEvents;
  const eventsByDay: Record<string, GridEvent[]> = {};
  for (const e of gridSource) {
    if (isManager && ownerFilter && (e as TeamCalendarItem).ownerName !== ownerFilter) continue;
    const key = dayKeyFormatter.format(e.startsAt);
    if (!key.startsWith(monthPrefix)) continue;
    (eventsByDay[key] ??= []).push({ id: e.id, title: e.title, toneClass: KIND_TONE[e.kind], label: calendarKindLabels[e.kind] });
  }
  const monthNav = (delta: number) => {
    const d = new Date(gridYear, gridMonthIndex + delta, 1);
    const mp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return `?month=${mp}${ownerFilter ? `&owner=${encodeURIComponent(ownerFilter)}` : ""}`;
  };
  const integrationCards = [
    { provider: CalendarProvider.GOOGLE, title: "Google Calendar", status: ConnectionStatus.DISCONNECTED },
    { provider: CalendarProvider.NAVER, title: "Naver Calendar", status: ConnectionStatus.DISCONNECTED }
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <DashboardHeader
          eyebrow="캘린더"
          title="업무 일정 통합 보기"
          description="업무 마감, 고객 미팅, 보고서 마감, 휴가, 내부 지시를 같은 일정표에서 확인합니다."
        />
        <div className="flex shrink-0 items-center gap-3">
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
            {RANGES.map(([r, label]) => (
              <a key={r} href={rangeQs(r)} className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${range === r ? "bg-card text-brand shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {label}
              </a>
            ))}
          </div>
          <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-slate-600">일정 {events.length}건</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {integrationCards.map((card) => (
          <div key={card.provider} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{card.title}</p>
                <p className="mt-1 text-sm text-slate-500">사내 캘린더가 기본입니다. 외부 캘린더로 <b>내보내기</b>는 선택 기능으로 준비 중입니다.</p>
              </div>
              <span className="rounded-md border border-line bg-surface px-3 py-1 text-xs font-semibold text-slate-600">
                선택 · 준비중
              </span>
            </div>
          </div>
        ))}
      </div>

      <MonthCalendar
        year={gridYear}
        monthIndex={gridMonthIndex}
        eventsByDay={eventsByDay}
        todayKey={todayKey}
        prevHref={monthNav(-1)}
        nextHref={monthNav(1)}
        monthLabel={`${gridYear}년 ${gridMonthIndex + 1}월${isManager ? " · 팀 전체" : ""}${ownerFilter ? ` · ${ownerFilter}` : ""}`}
      />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-ink">오늘 내 업무 배치 ({todayKey})</h3>
        <CalendarScheduler
          day={todayKey}
          items={schedulerItems}
          capacityMinutes={companySetting?.workloadDailyMinutes ?? 480}
        />
      </div>

      {isManager && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-ink">담당자별 팀 일정</h3>
            <span className="text-xs text-slate-500">담당자 {Object.keys(teamByOwner).length}명 · 일정 {teamEvents.length}건</span>
          </div>
          {owners.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <a href={ownerQs("")} className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${!ownerFilter ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface text-slate-500 hover:text-slate-700"}`}>전체</a>
              {owners.map((o) => (
                <a key={o} href={ownerQs(o)} className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${ownerFilter === o ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface text-slate-500 hover:text-slate-700"}`}>{o}</a>
              ))}
            </div>
          )}
          {teamEvents.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(teamByOwner).map(([owner, ownerEvents]) => (
                <div key={owner} className="rounded-2xl border border-line bg-white p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-2 font-semibold text-ink">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">{owner.slice(0, 1)}</span>
                      {owner}
                    </p>
                    <span className="text-xs text-slate-400">{ownerEvents.length}건</span>
                  </div>
                  <ul className="space-y-1.5">
                    {ownerEvents.slice(0, 6).map((event) => (
                      <li key={event.id} className="flex items-center gap-2 text-sm">
                        <span className="w-16 shrink-0 text-xs text-slate-400">{dateFormatter.format(event.startsAt).replace(/\s/g, "").slice(5)}</span>
                        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${KIND_TONE[event.kind]}`}>{calendarKindLabels[event.kind]}</span>
                        <span className="truncate text-slate-700">{event.title}</span>
                      </li>
                    ))}
                    {ownerEvents.length > 6 && <li className="text-[11px] text-slate-400">+{ownerEvents.length - 6}건 더</li>}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-line bg-white px-5 py-8 text-center text-sm text-slate-500">팀 일정이 없습니다.</p>
          )}
        </div>
      )}

      <div className="rounded-md border border-line bg-white">
        {Object.keys(groupedEvents).length > 0 ? (
          Object.entries(groupedEvents).map(([day, dayEvents]) => (
            <div key={day} className="px-5 py-4">
              <h3 className="text-sm font-semibold text-brand">{dateFormatter.format(new Date(`${day}T00:00:00.000Z`))}</h3>
              <ul className="mt-2">
                {dayEvents.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="px-5 py-8 text-center text-sm text-slate-500">조회 가능한 일정이 없습니다.</p>
        )}
      </div>
    </section>
  );
}
