"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkItem } from "@/server/actions/work";
import { WorkCategory } from "@/domain/types";
import { workCategoryLabels } from "@/domain/work";

const inputCls = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export function AddWorkForm({
  clientId,
  marketers
}: {
  clientId: string;
  marketers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    const due = String(fd.get("dueDate") || "");
    const payload: Record<string, unknown> = {
      clientId,
      ownerId: String(fd.get("ownerId") || ""),
      title: String(fd.get("title") || ""),
      category: String(fd.get("category") || ""),
      priority: fd.get("priority") ? Number(fd.get("priority")) : undefined
    };
    if (due) payload.dueDate = due;
    start(async () => {
      const res = await createWorkItem(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white"
      >
        + 업무 추가
      </button>
    );
  }

  return (
    <form action={onSubmit} className="rounded-2xl border border-line bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="text-xs font-semibold text-slate-500">업무명 *</span>
          <input name="title" required placeholder="예: 7월 블로그 원고 5건" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">카테고리 *</span>
          <select name="category" required className={inputCls} defaultValue={WorkCategory.BRAND_BLOG}>
            {Object.values(WorkCategory).map((c) => (
              <option key={c} value={c}>{workCategoryLabels[c]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">담당자 *</span>
          <select name="ownerId" required className={inputCls} defaultValue="">
            <option value="" disabled>선택</option>
            {marketers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">마감일</span>
          <input name="dueDate" type="date" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">우선순위 (1~5)</span>
          <input name="priority" type="number" min="1" max="5" defaultValue="3" className={inputCls} />
        </label>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-danger">
          {error === "VALIDATION"
            ? "입력값을 확인해 주세요."
            : error === "FORBIDDEN"
              ? "이 거래처에 업무를 추가할 권한이 없습니다."
              : "저장에 실패했습니다."}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "저장 중…" : "업무 추가"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-line px-4 py-2 text-sm text-slate-600">
          취소
        </button>
      </div>
    </form>
  );
}
