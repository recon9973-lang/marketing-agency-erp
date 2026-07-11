"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, UserCheck, UserPlus } from "lucide-react";
import { checkInMeeting, checkOutMeeting } from "@/server/actions/meetings";
import type { MeetingAttendeeItem } from "@/server/repositories/meetings";

export function AttendeeCheckIn({
  meetingId,
  attendees,
  currentUserId
}: {
  meetingId: string;
  attendees: MeetingAttendeeItem[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const joined = attendees.some((a) => a.userId === currentUserId);

  function toggle() {
    start(async () => {
      const res = joined ? await checkOutMeeting({ id: meetingId }) : await checkInMeeting({ id: meetingId });
      if (!res.ok) return alert(res.error);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">참석자 ({attendees.length})</h3>
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={
            joined
              ? "inline-flex items-center gap-1.5 rounded-md border border-brand/40 bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-strong disabled:opacity-50"
              : "inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          }
        >
          {joined ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
          {joined ? "참석 중 (취소)" : "참석 체크인"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {attendees.length === 0 ? (
          <p className="text-sm text-slate-500">아직 체크인한 참석자가 없습니다. 회의에 들어오면 “참석 체크인”을 눌러주세요.</p>
        ) : (
          attendees.map((a) => (
            <span
              key={a.userId}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              <Check className="h-3 w-3 text-emerald-600" /> {a.name}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
