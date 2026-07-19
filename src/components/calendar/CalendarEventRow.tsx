"use client";

// 자체 캘린더 · 일정 목록 행 — 표시 + 수정/삭제(독립 일정만).
// 표시 문자열·수정 초기값은 서버(page)에서 계산해 전달(클라 번들에 서버코드 미포함).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteCalendarEvent } from "@/server/actions/calendar-event";
import { CalendarEventForm, type EventInitial } from "./CalendarEventForm";

type Member = { id: string; name: string };

export function CalendarEventRow({
  timeLabel,
  kindLabel,
  toneClass,
  title,
  subtitle,
  owner,
  editable,
  initial,
  members,
  canAssignOthers,
  selfId,
  selfName,
  defaultDate
}: {
  timeLabel: string;
  kindLabel: string;
  toneClass: string;
  title: string;
  subtitle: string;
  owner?: string;
  editable: boolean;
  initial: EventInitial;
  members: Member[];
  canAssignOthers: boolean;
  selfId: string;
  selfName: string;
  defaultDate: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm(`"${title}" 일정을 삭제할까요?`)) return;
    setError(null);
    start(async () => {
      const res = await deleteCalendarEvent({ id: initial.id });
      if (!res.ok) {
        setError(res.error === "SYSTEM_EVENT" ? "연결 일정은 삭제할 수 없습니다." : "삭제에 실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  if (editing) {
    return (
      <li id={`event-${initial.id}`} className="scroll-mt-24 border-t border-line py-3">
        <CalendarEventForm
          mode="edit"
          initial={initial}
          members={members}
          canAssignOthers={canAssignOthers}
          selfId={selfId}
          selfName={selfName}
          defaultDate={defaultDate}
          onClose={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li id={`event-${initial.id}`} className="grid scroll-mt-24 grid-cols-1 gap-3 rounded-lg border-t border-line py-4 target:bg-brand/5 target:ring-2 target:ring-brand/30 md:grid-cols-[9rem_1fr_auto] md:items-center">
      <div className="text-sm text-slate-500">{timeLabel}</div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={toneClass}>{kindLabel}</span>
          <p className="font-medium text-ink">{title}</p>
          {owner ? <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-slate-500">{owner}</span> : null}
        </div>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      </div>
      <div className="flex items-center gap-1.5 md:justify-end">
        {editable ? (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-slate-600 hover:bg-surface"
            >
              <Pencil className="h-3.5 w-3.5" /> 수정
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-slate-500 hover:bg-rose-50 hover:text-danger disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> 삭제
            </button>
          </>
        ) : (
          <span className="text-xs text-slate-300">시스템 일정</span>
        )}
      </div>
    </li>
  );
}
