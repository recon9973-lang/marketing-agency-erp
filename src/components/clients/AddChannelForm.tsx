"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addClientAccount } from "@/server/actions/clients";

const PLATFORMS: { value: string; label: string }[] = [
  { value: "BLOG", label: "블로그" },
  { value: "SNS", label: "SNS" },
  { value: "PLACE", label: "플레이스" },
  { value: "RECEIPT_REVIEW", label: "영수증 리뷰" },
  { value: "ANALYTICS", label: "애널리틱스" },
  { value: "OTHER", label: "기타" }
];

const inputCls = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export function AddChannelForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    const payload = {
      clientId,
      platform: String(fd.get("platform") || "OTHER"),
      label: String(fd.get("label") || ""),
      handle: String(fd.get("handle") || "") || null,
      externalUrl: String(fd.get("externalUrl") || "") || null
    };
    start(async () => {
      const res = await addClientAccount(payload);
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
        + 채널 추가
      </button>
    );
  }

  return (
    <form action={onSubmit} className="rounded-xl border border-line bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">채널 종류 *</span>
          <select name="platform" required className={inputCls} defaultValue="BLOG">
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">이름/라벨 *</span>
          <input name="label" required placeholder="예: 네이버 블로그 메인" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">계정 핸들</span>
          <input name="handle" placeholder="@handle" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">링크(URL)</span>
          <input name="externalUrl" type="url" placeholder="https://…" className={inputCls} />
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error === "VALIDATION" ? "입력값을 확인해 주세요. (URL 형식 등)" : "저장에 실패했습니다."}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "저장 중…" : "채널 추가"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-line px-4 py-2 text-sm text-slate-600">
          취소
        </button>
      </div>
    </form>
  );
}
