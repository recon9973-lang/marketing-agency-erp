import { redirect } from "next/navigation";
import { calendarKindLabels, fetchCalendarEventsForUser, type CalendarListItem } from "@/server/repositories/calendar";
import { CalendarProvider, ConnectionStatus } from "@/domain/types";
import { getSchedulerDay } from "@/server/repositories/work";
import { getCurrentUser } from "@/server/session";
import { CalendarScheduler } from "@/components/calendar/CalendarScheduler";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });
const timeFormatter = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" });

function groupByDay(events: CalendarListItem[]) {
  return events.reduce<Record<string, CalendarListItem[]>>((groups, event) => {
    const key = event.startsAt.toISOString().slice(0, 10);
    groups[key] = [...(groups[key] ?? []), event];
    return groups;
  }, {});
}

function providerLabel(provider: CalendarProvider) {
  if (provider === CalendarProvider.GOOGLE) return "Google";
  if (provider === CalendarProvider.NAVER) return "Naver";
  return "Internal";
}

function connectionCopy(status: ConnectionStatus) {
  if (status === ConnectionStatus.CONNECTED) return "연결됨";
  if (status === ConnectionStatus.ERROR) return "확인필요";
  return "준비중";
}

function EventRow({ event }: { event: CalendarListItem }) {
  return (
    <li className="grid gap-3 border-t border-line py-4 md:grid-cols-[9rem_1fr_8rem] md:items-center">
      <div className="text-sm text-slate-500">
        {timeFormatter.format(event.startsAt)} - {timeFormatter.format(event.endsAt)}
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-line bg-surface px-2 py-1 text-xs font-semibold text-slate-600">{calendarKindLabels[event.kind]}</span>
          <p className="font-medium text-ink">{event.title}</p>
        </div>
        <p className="mt-1 text-sm text-slate-600">{event.clientName ?? event.description ?? "사내 일정"}</p>
      </div>
      <div className="text-sm text-slate-500">{providerLabel(event.provider)}</div>
    </li>
  );
}

export default async function CalendarPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const events = await fetchCalendarEventsForUser(user);
  const groupedEvents = groupByDay(events);
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const schedulerItems = await getSchedulerDay(user, user.id, today);
  const integrationCards = [
    { provider: CalendarProvider.GOOGLE, title: "Google Calendar", status: ConnectionStatus.DISCONNECTED },
    { provider: CalendarProvider.NAVER, title: "Naver Calendar", status: ConnectionStatus.DISCONNECTED }
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand">캘린더</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">업무 일정 통합 보기</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            업무 마감, 고객 미팅, 보고서 마감, 휴가, 내부 지시를 같은 일정표에서 확인합니다.
          </p>
        </div>
        <div className="rounded-md border border-line bg-white px-4 py-3 text-sm text-slate-600">예정 일정 {events.length}건</div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {integrationCards.map((card) => (
          <div key={card.provider} className="rounded-md border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{card.title}</p>
                <p className="mt-1 text-sm text-slate-500">OAuth 키 등록 후 양방향 동기화를 연결할 수 있습니다.</p>
              </div>
              <span className="rounded-md border border-line bg-surface px-3 py-1 text-xs font-semibold text-slate-600">
                {connectionCopy(card.status)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-ink">오늘 일정 배치 (내 업무)</h3>
        <CalendarScheduler day={todayKey} items={schedulerItems} />
      </div>

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
