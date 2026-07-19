"use client";

// 자체 캘린더 · 일정 폼(C4) — 독립 일정 생성/수정 + 담당자 직접배정.
// 제어 컴포넌트(useState) — FormData 대신 상태로 안정 처리(코드베이스 폼 규약과 일치).
// mode="create": "일정 추가" 트리거 버튼 + 접이식 폼. mode="edit": 인라인(항상 열림).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { createCalendarEvent, updateCalendarEvent } from "@/server/actions/calendar-event";

type Member = { id: string; name: string };

export type EventInitial = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  kind: string;
  assigneeId: string | null;
  description: string;
};

const KIND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "TASK", label: "업무" },
  { value: "CLIENT_MEETING", label: "미팅" },
  { value: "REPORT_DEADLINE", label: "마감" },
  { value: "INTERNAL_INSTRUCTION", label: "사내" }
];

const field = "mt-1 w-full rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand";
const pickerField = `${field} cursor-pointer`;
function openPicker(e: React.MouseEvent<HTMLInputElement>) {
  const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
  try {
    el.showPicker?.();
  } catch {
    /* 미지원 브라우저는 기본 동작 유지 */
  }
}

// "HH:mm" + 60분(24시 넘으면 23:59로 클램프 — 같은 날짜 이벤트).
function addOneHour(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const total = Math.min(h * 60 + m + 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function CalendarEventForm({
  members,
  canAssignOthers,
  selfId,
  selfName,
  defaultDate,
  mode = "create",
  initial,
  onClose
}: {
  members: Member[];
  canAssignOthers: boolean;
  selfId: string;
  selfName: string;
  defaultDate: string; // YYYY-MM-DD (현재 뷰 기준일)
  mode?: "create" | "edit";
  initial?: EventInitial; // edit 모드 초기값
  onClose?: () => void; // edit 모드 닫기
}) {
  const isEdit = mode === "edit";
  const router = useRouter();
  const [open, setOpen] = useState(isEdit); // edit는 항상 열림
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 담당자 후보 — 로그인 본인을 맨 위로. 관리자만 타인 배정 가능.
  const options: Member[] = canAssignOthers
    ? [{ id: selfId, name: selfName }, ...members.filter((m) => m.id !== selfId)]
    : [{ id: selfId, name: selfName }];

  // 제어 상태(edit면 초기값 시드).
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(initial?.startTime ?? "10:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "11:00");
  const [endManual, setEndManual] = useState(isEdit); // 수정 시 종료는 사용자 값 유지
  const [kind, setKind] = useState(initial?.kind ?? "TASK");
  const [assigneeId, setAssigneeId] = useState(initial?.assigneeId ?? selfId);
  const [description, setDescription] = useState(initial?.description ?? "");

  function resetCreate() {
    setTitle("");
    setDate(defaultDate);
    setStartTime("10:00");
    setEndTime("11:00");
    setEndManual(false);
    setKind("TASK");
    setAssigneeId(selfId);
    setDescription("");
    setError(null);
  }

  function onStartChange(v: string) {
    setStartTime(v);
    if (!endManual) setEndTime(addOneHour(v));
  }
  function onEndChange(v: string) {
    setEndTime(v);
    setEndManual(true);
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
      const payload = {
        title: title.trim(),
        date,
        startTime,
        endTime,
        kind,
        assigneeId: canAssignOthers ? assigneeId : selfId,
        description: description.trim() || null
      };
      const res = isEdit
        ? await updateCalendarEvent({ id: initial!.id, ...payload })
        : await createCalendarEvent(payload);
      if (!res.ok) {
        setError(
          res.error === "FORBIDDEN"
            ? "해당 담당자에게 배정할 권한이 없습니다."
            : res.error === "SYSTEM_EVENT"
              ? "업무·연차 연결 일정은 수정할 수 없습니다."
              : res.error === "VALIDATION"
                ? "입력값을 확인하세요(제목·날짜·시간)."
                : "저장에 실패했습니다. 다시 시도해 주세요."
        );
        return;
      }
      if (isEdit) {
        onClose?.();
      } else {
        resetCreate();
        setOpen(false);
      }
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
        <p className="text-sm font-bold text-ink">{isEdit ? "일정 수정" : "새 일정"}</p>
        <button
          type="button"
          onClick={() => { if (isEdit) onClose?.(); else { resetCreate(); setOpen(false); } }}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          닫기
        </button>
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
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} onClick={openPicker} className={pickerField} />
        </label>
        <label className="block text-xs font-medium text-slate-600">시작
          <input type="time" value={startTime} onChange={(e) => onStartChange(e.target.value)} onClick={openPicker} className={pickerField} />
        </label>
        <label className="block text-xs font-medium text-slate-600">종료 <span className="font-normal text-slate-400">(자동 +1시간)</span>
          <input type="time" value={endTime} onChange={(e) => onEndChange(e.target.value)} onClick={openPicker} className={pickerField} />
        </label>
        <label className="block text-xs font-medium text-slate-600 sm:col-span-2 lg:col-span-4">메모(선택)
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={field} placeholder="상세 내용" />
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={submit} disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "저장 중…" : isEdit ? "수정 저장" : "일정 저장"}
        </button>
      </div>
    </div>
  );
}
