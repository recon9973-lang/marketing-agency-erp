"use client";

// 자체 캘린더 · 일정 추가 폼(C4) — 독립 일정 생성 + 담당자 직접배정.
// 접이식. 관리자는 담당자 지정 가능, 담당자는 본인 일정으로 자동 생성.
// 제어 컴포넌트(useState) — FormData 대신 상태로 안정 처리(코드베이스 폼 규약과 일치).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { createCalendarEvent } from "@/server/actions/calendar-event";

type Member = { id: string; name: string };

const KIND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "TASK", label: "업무" },
  { value: "CLIENT_MEETING", label: "미팅" },
  { value: "REPORT_DEADLINE", label: "마감" },
  { value: "INTERNAL_INSTRUCTION", label: "사내" }
];

const field = "mt-1 w-full rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand";

export function CalendarEventForm({
  members,
  canAssignOthers,
  selfId,
  selfName,
  defaultDate
}: {
  members: Member[];
  canAssignOthers: boolean;
  selfId: string;
  selfName: string;
  defaultDate: string; // YYYY-MM-DD (현재 뷰 기준일)
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 담당자 후보 — 로그인 본인을 맨 위로(기본 선택). 관리자만 타인 배정 가능.
  const options: Member[] = canAssignOthers
    ? [{ id: selfId, name: selfName }, ...members.filter((m) => m.id !== selfId)]
    : [{ id: selfId, name: selfName }];

  // 제어 상태.
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [kind, setKind] = useState("TASK");
  const [assigneeId, setAssigneeId] = useState(selfId); // 로그인 계정 자동 선택
  const [description, setDescription] = useState("");

  function reset() {
    setTitle("");
    setDate(defaultDate);
    setStartTime("10:00");
    setEndTime("11:00");
    setKind("TASK");
    setAssigneeId(selfId);
    setDescription("");
    setError(null);
  }

  function submit() {
    setError(null);
    if (!title.trim()) {
      setError("제목을 입력하세요.");
      return;
    }
    if (endTime < startTime) {
      setError("종료 시각이 시작 시각보다 빠릅니다.");
      return;
    }
    start(async () => {
      const res = await createCalendarEvent({
        title: title.trim(),
        date,
        startTime,
        endTime,
        kind,
        assigneeId: canAssignOthers ? assigneeId : selfId,
        description: description.trim() || null
      });
      if (!res.ok) {
        setError(
          res.error === "FORBIDDEN"
            ? "해당 담당자에게 배정할 권한이 없습니다."
            : res.error === "VALIDATION"
              ? "입력값을 확인하세요(제목·날짜·시간)."
              : "일정 저장에 실패했습니다. 다시 시도해 주세요."
        );
        return;
      }
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-strong"
      >
        <CalendarPlus className="h-4 w-4" /> 일정 추가
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-ink">새 일정</p>
        <button type="button" onClick={() => { reset(); setOpen(false); }} className="text-xs text-slate-400 hover:text-slate-600">닫기</button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs font-medium text-slate-600 sm:col-span-2">제목
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="예: 미소진의원 정기 리뷰" autoFocus />
        </label>
        <label className="block text-xs font-medium text-slate-600">종류
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </label>
        {canAssignOthers ? (
          <label className="block text-xs font-medium text-slate-600">담당자
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={field}>
              {options.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.id === selfId ? " (나)" : ""}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="block text-xs font-medium text-slate-600">담당자
            <p className={`${field} bg-surface/60 text-slate-500`}>{selfName} (나)</p>
          </div>
        )}
        <label className="block text-xs font-medium text-slate-600">날짜
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <label className="block text-xs font-medium text-slate-600">시작
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={field} />
        </label>
        <label className="block text-xs font-medium text-slate-600">종료
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={field} />
        </label>
        <label className="block text-xs font-medium text-slate-600 sm:col-span-2 lg:col-span-4">메모(선택)
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={field} placeholder="상세 내용" />
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={submit} disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "저장 중…" : "일정 저장"}
        </button>
      </div>
    </div>
  );
}
