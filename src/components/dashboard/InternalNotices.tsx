"use client";

// 대시보드 위젯 — 내부 공지사항(관리자 작성). 검색엔진 공지와 나란히 반폭으로 배치.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, Trash2, Pin, X } from "lucide-react";
import { createInternalNotice, deleteInternalNotice } from "@/server/actions/notices";
import type { InternalNoticeRow } from "@/server/repositories/internal-notice";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { year: "2-digit", month: "numeric", day: "numeric" });

export function InternalNotices({ notices, canManage }: { notices: InternalNoticeRow[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function submit() {
    if (!title.trim() || !body.trim()) return;
    start(async () => {
      const res = await createInternalNotice({ title, body, pinned });
      if (res.ok) {
        setTitle("");
        setBody("");
        setPinned(false);
        setOpen(false);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    start(async () => {
      await deleteInternalNotice({ id });
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-bold text-ink">공지사항</h2>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-brand hover:text-brand"
          >
            {open ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {open ? "닫기" : "작성"}
          </button>
        )}
      </div>

      {canManage && open && (
        <div className="mt-3 space-y-2 rounded-xl border border-line bg-surface/40 p-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="내용" rows={3} className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-3.5 w-3.5 accent-brand" /> 상단 고정
            </label>
            <button type="button" onClick={submit} disabled={pending || !title.trim() || !body.trim()} className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">
              {pending ? "게시 중…" : "게시"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {notices.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-surface/40 px-3 py-6 text-center text-xs text-slate-400">
            등록된 내부 공지가 없습니다.{canManage ? " ‘작성’으로 첫 공지를 올려보세요." : ""}
          </p>
        ) : (
          notices.map((n) => (
            <div key={n.id} className="rounded-lg border border-line bg-surface/30 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-1 text-sm font-semibold text-ink">
                  {n.pinned && <Pin className="h-3 w-3 text-brand" />} {n.title}
                </p>
                {canManage && (
                  <button type="button" onClick={() => remove(n.id)} disabled={busyId === n.id} className="shrink-0 text-slate-300 hover:text-rose-500" aria-label="삭제">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{n.body}</p>
              <p className="mt-1 text-[10px] text-slate-400">
                {n.authorName ?? "관리자"} · {dateFmt.format(new Date(n.createdAt))}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
