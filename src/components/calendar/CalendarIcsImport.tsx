"use client";

// 자체 캘린더 · .ics 가져오기 — 외부 캘린더(구글·애플·아웃룩·네이버)에서 내보낸
// .ics 파일을 내 일정으로 편입. 파일은 브라우저에서 텍스트로 읽어 서버 액션에 넘긴다
// (FormData 미사용 — 코드베이스 폼 규약과 일치). 편입 일정은 수정·삭제·재-내보내기 가능.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarArrowDown } from "lucide-react";
import { importCalendarIcs } from "@/server/actions/calendar-event";

const KIND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "INTERNAL_INSTRUCTION", label: "사내" },
  { value: "TASK", label: "업무" },
  { value: "CLIENT_MEETING", label: "미팅" },
  { value: "REPORT_DEADLINE", label: "마감" }
];

const MAX_BYTES = 3_000_000;

export function CalendarIcsImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("INTERNAL_INSTRUCTION");
  const [fileName, setFileName] = useState<string | null>(null);
  const [icsText, setIcsText] = useState<string>("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("파일이 너무 큽니다(최대 3MB).");
      setFileName(null);
      setIcsText("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setIcsText(typeof reader.result === "string" ? reader.result : "");
      setFileName(file.name);
    };
    reader.onerror = () => setError("파일을 읽지 못했습니다.");
    reader.readAsText(file);
  }

  function submit() {
    setError(null);
    setResult(null);
    if (!icsText.trim()) {
      setError(".ics 파일을 먼저 선택하세요.");
      return;
    }
    start(async () => {
      const res = await importCalendarIcs({ icsText, kind });
      if (!res.ok) {
        setError(
          res.error === "NO_EVENTS"
            ? "가져올 일정이 없습니다(.ics 안에 일정이 없어요)."
            : res.error === "VALIDATION"
              ? "파일 형식을 확인하세요(.ics)."
              : "가져오기에 실패했습니다. 다시 시도해 주세요."
        );
        return;
      }
      const { imported, updated, skipped, truncated } = res.data ?? { imported: 0, updated: 0, skipped: 0, truncated: 0 };
      const parts = [`신규 ${imported}건`, `갱신 ${updated}건`];
      if (skipped) parts.push(`건너뜀 ${skipped}건`);
      if (truncated) parts.push(`초과 ${truncated}건 제외(최대 500)`);
      setResult(`가져오기 완료 — ${parts.join(" · ")}`);
      setFileName(null);
      setIcsText("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-card hover:text-brand"
        title="구글·애플·아웃룩·네이버에서 내보낸 .ics 파일을 내 일정으로 가져오기"
      >
        <CalendarArrowDown className="h-4 w-4" /> 가져오기 (.ics)
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-ink">.ics 가져오기</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
          닫기
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        구글·애플·아웃룩·네이버 캘린더에서 <b>내보낸 .ics 파일</b>을 선택하면 내 일정으로 편입됩니다. 같은 파일을 다시 올려도 <b>중복 없이 갱신</b>됩니다(일정 고유ID 기준).
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-slate-600 sm:col-span-2">.ics 파일
          <input
            ref={inputRef}
            type="file"
            accept=".ics,text/calendar"
            onChange={onPick}
            className="mt-1 w-full rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-ink file:mr-3 file:rounded file:border-0 file:bg-surface file:px-2 file:py-1 file:text-xs file:font-semibold file:text-slate-600"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">종류로 저장
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand">
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </label>
      </div>
      {fileName ? <p className="mt-2 text-xs text-slate-500">선택됨: {fileName}</p> : null}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      {result ? <p className="mt-2 text-sm font-semibold text-emerald-600">{result}</p> : null}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !icsText}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "가져오는 중…" : "가져오기"}
        </button>
      </div>
    </div>
  );
}
