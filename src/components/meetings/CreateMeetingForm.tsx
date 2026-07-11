"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { createMeeting } from "@/server/actions/meetings";

const inputCls = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export function CreateMeetingForm({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    const payload = {
      title: String(fd.get("title") || ""),
      clientId: String(fd.get("clientId") || "") || null,
      meetingDate: String(fd.get("meetingDate") || "") || null
    };
    start(async () => {
      const res = await createMeeting(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      if (res.data?.id) router.push(`/meetings/${res.data.id}` as Route);
      else router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white">
        + 새 회의
      </button>
    );
  }

  return (
    <form action={onSubmit} className="rounded-2xl border border-line bg-white p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block md:col-span-1">
          <span className="text-xs font-semibold text-slate-500">회의명 *</span>
          <input name="title" required placeholder="예: OO의원 3월 마케팅 정기회의" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">거래처 (선택)</span>
          <select name="clientId" className={inputCls} defaultValue="">
            <option value="">연계 안 함</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">일시</span>
          <input name="meetingDate" type="datetime-local" className={inputCls} />
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "생성 중…" : "회의 만들기"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-line px-4 py-2 text-sm text-slate-600">
          취소
        </button>
      </div>
    </form>
  );
}
