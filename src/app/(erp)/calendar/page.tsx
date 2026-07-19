import { redirect } from "next/navigation";
import { CalendarScheduler } from "@/components/calendar/CalendarScheduler";
import { MonthCalendar, type GridEvent } from "@/components/calendar/MonthCalendar";
import { WeekCalendar, type WeekEvent } from "@/components/calendar/WeekCalendar";
import { CalendarEventForm } from "@/components/calendar/CalendarEventForm";
import { CalendarEventRow } from "@/components/calendar/CalendarEventRow";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { listActiveMembers } from "@/server/repositories/collab";
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
const kstHmFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function kstMinutes(d: Date): number {
  const [h, m] = kstHmFormatter.format(d).split(":").map(Number);
  return h * 60 + m;
}

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

function groupByDay<T extends CalendarListItem>(events: T[]) {
  return events.reduce<Record<string, T[]>>((groups, event) => {
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


export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const view = one(sp.view) === "week" ? "week" : "month"; // 뷰가 격자·목록을 함께 결정
  const ownerFilter = one(sp.owner) ?? "";

  const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
  const todayKey = dayKeyFormatter.format(new Date());
  const [allEvents, schedulerItems, companySetting, allTeamEvents, members] = await Promise.all([
    fetchCalendarEventsForUser(user),
    getSchedulerDay(user, user.id, new Date(`${todayKey}T00:00:00`)),
    db.companySetting.findFirst({ select: { workloadDailyMinutes: true } }),
    isManager ? fetchTeamCalendarEvents(user) : Promise.resolve([] as TeamCalendarItem[]),
    isManager ? listActiveMembers() : Promise.resolve([] as { id: string; name: string }[])
  ]);

  // KST 일자키 유틸(서버 TZ 무관 — UTC 정오 기준).
  const pad = (n: number) => String(n).padStart(2, "0");
  const keyToDate = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
  const dateToKey = (dt: Date) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  const shiftKey = (k: string, days: number) => { const dt = keyToDate(k); dt.setUTCDate(dt.getUTCDate() + days); return dateToKey(dt); };

  // 월간 기준월 / 주간 기준일
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(one(sp.month) ?? "");
  const gridYear = monthMatch ? Number(monthMatch[1]) : Number(todayKey.slice(0, 4));
  const gridMonthIndex = monthMatch ? Number(monthMatch[2]) - 1 : Number(todayKey.slice(5, 7)) - 1;
  const monthPrefix = `${gridYear}-${pad(gridMonthIndex + 1)}`;
  const wkRef = one(sp.wk) ?? todayKey;
  const weekStartKey = shiftKey(wkRef, -keyToDate(wkRef).getUTCDay()); // 그 주 일요일
  const weekKeys = Array.from({ length: 7 }, (_, i) => shiftKey(weekStartKey, i));

  const inView = (key: string) => (view === "week" ? weekKeys.includes(key) : key.startsWith(monthPrefix));
  const gridLabel =
    (view === "week"
      ? `${Number(weekKeys[0].slice(5, 7))}월 ${Number(weekKeys[0].slice(8, 10))}일~${Number(weekKeys[6].slice(8, 10))}일`
      : `${gridYear}년 ${gridMonthIndex + 1}월`) + (isManager ? " · 팀 전체" : "") + (ownerFilter ? ` · ${ownerFilter}` : "");

  // 뷰 기간으로 목록·팀뷰·격자를 함께 필터(일관).
  const events = allEvents.filter((e) => inView(dayKeyFormatter.format(e.startsAt)));
  const teamEvents = allTeamEvents.filter((e) => inView(dayKeyFormatter.format(e.startsAt)) && (!ownerFilter || e.ownerName === ownerFilter));
  const owners = [...new Set(allTeamEvents.map((e) => e.ownerName))].sort();
  // 일정 추가 폼 기본 날짜 — 현재 뷰에 오늘이 포함되면 오늘, 아니면 뷰 시작일.
  const defaultDate = view === "week" ? (weekKeys.includes(todayKey) ? todayKey : weekKeys[0]) : todayKey.startsWith(monthPrefix) ? todayKey : `${monthPrefix}-01`;

  const eventsByDay: Record<string, GridEvent[]> = {};
  for (const e of isManager ? teamEvents : events) {
    const key = dayKeyFormatter.format(e.startsAt);
    (eventsByDay[key] ??= []).push({ id: e.id, title: e.title, toneClass: KIND_TONE[e.kind], label: calendarKindLabels[e.kind], href: `#event-${e.id}` });
  }

  // 주간 타임그리드용 시간 블록(KST 분).
  const weekEvents: WeekEvent[] =
    view === "week"
      ? (isManager ? teamEvents : events).map((e) => {
          const startMin = kstMinutes(e.startsAt);
          const rawEnd = kstMinutes(e.endsAt);
          return {
            id: e.id,
            dayKey: dayKeyFormatter.format(e.startsAt),
            startMin,
            endMin: rawEnd > startMin ? rawEnd : 24 * 60, // 자정 넘김·동시각은 일 끝으로 클램프
            title: e.title,
            toneClass: KIND_TONE[e.kind],
            label: calendarKindLabels[e.kind],
            timeLabel: `${kstHmFormatter.format(e.startsAt)}–${kstHmFormatter.format(e.endsAt)}`,
            href: `#event-${e.id}`
          };
        })
      : [];
  const nowMin = kstMinutes(new Date());

  // 하단 목록은 격자와 같은 소스로 — 격자 이벤트 클릭(#event-id) 시 하단 편집 행으로 1:1 스크롤.
  const groupedEvents = groupByDay(isManager ? teamEvents : events);
  const teamByOwner = groupByOwner(teamEvents);

  // 네비/토글 링크(현재 뷰·오너 유지)
  const ownerSuffix = ownerFilter ? `&owner=${encodeURIComponent(ownerFilter)}` : "";
  const todayHref = `?view=week${ownerSuffix}`;
  const viewQs = (v: string) => `?view=${v}${ownerSuffix}`;
  const ownerQs = (o: string) => `?view=${view}&${view === "week" ? `wk=${wkRef}` : `month=${monthPrefix}`}${o ? `&owner=${encodeURIComponent(o)}` : ""}`;
  const gridPrev = view === "week" ? `?view=week&wk=${shiftKey(weekStartKey, -7)}${ownerSuffix}` : `?view=month&month=${dateToKey(new Date(Date.UTC(gridYear, gridMonthIndex - 1, 1, 12))).slice(0, 7)}${ownerSuffix}`;
  const gridNext = view === "week" ? `?view=week&wk=${shiftKey(weekStartKey, 7)}${ownerSuffix}` : `?view=month&month=${dateToKey(new Date(Date.UTC(gridYear, gridMonthIndex + 1, 1, 12))).slice(0, 7)}${ownerSuffix}`;
  const VIEWS: [string, string][] = [["week", "주간"], ["month", "월간"]];
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
            {VIEWS.map(([v, lbl]) => (
              <a key={v} href={viewQs(v)} className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${view === v ? "bg-card text-brand shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {lbl}
              </a>
            ))}
          </div>
          <a
            href="/calendar/export"
            className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-card hover:text-brand"
            title="내 일정을 .ics 파일로 내보내 구글·애플·아웃룩에서 구독/가져오기"
          >
            내보내기 (.ics)
          </a>
          <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-slate-600">일정 {events.length}건</div>
        </div>
      </div>

      {/* 자체 캘린더 · 일정 추가(C4) — 접이식. 관리자는 담당자 지정. */}
      <CalendarEventForm members={members} canAssignOthers={isManager} selfId={user.id} selfName={user.name} defaultDate={defaultDate} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {integrationCards.map((card) => (
          <div key={card.provider} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{card.title}</p>
                <p className="mt-1 text-sm text-slate-500">사내 캘린더가 기본입니다. 지금은 위 <b>내보내기(.ics)</b>로 {card.title}에 가져오기/구독할 수 있고, 실시간 양방향 연동은 준비 중입니다.</p>
              </div>
              <span className="rounded-md border border-line bg-surface px-3 py-1 text-xs font-semibold text-slate-600">
                선택 · 준비중
              </span>
            </div>
          </div>
        ))}
      </div>

      {view === "week" ? (
        <WeekCalendar weekDays={weekKeys} events={weekEvents} todayKey={todayKey} nowMin={nowMin} prevHref={gridPrev} nextHref={gridNext} todayHref={todayHref} label={gridLabel} />
      ) : (
        <MonthCalendar year={gridYear} monthIndex={gridMonthIndex} eventsByDay={eventsByDay} todayKey={todayKey} prevHref={gridPrev} nextHref={gridNext} label={gridLabel} />
      )}

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
                  <CalendarEventRow
                    key={event.id}
                    timeLabel={`${timeFormatter.format(event.startsAt)} - ${timeFormatter.format(event.endsAt)}`}
                    kindLabel={calendarKindLabels[event.kind]}
                    toneClass={kindBadge(event.kind)}
                    title={event.title}
                    subtitle={event.clientName ?? event.description ?? "사내 일정"}
                    owner={"ownerName" in event ? (event as TeamCalendarItem).ownerName : undefined}
                    editable={event.editable}
                    initial={{
                      id: event.id,
                      title: event.title,
                      date: dayKeyFormatter.format(event.startsAt),
                      startTime: kstHmFormatter.format(event.startsAt),
                      endTime: kstHmFormatter.format(event.endsAt),
                      kind: event.kind,
                      assigneeId: event.assigneeId,
                      description: event.description ?? ""
                    }}
                    members={members}
                    canAssignOthers={isManager}
                    selfId={user.id}
                    selfName={user.name}
                    defaultDate={defaultDate}
                  />
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
