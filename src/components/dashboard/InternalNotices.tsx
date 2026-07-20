"use client";

// 대시보드 위젯 — 내부 공지사항(관리자 작성). 검색엔진 공지와 나란히 반폭으로 배치.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, Trash2, Pin, X, ArrowRight } from "lucide-react";
import { createInternalNotice, deleteInternalNotice } from "@/server/actions/notices";
import type { InternalNoticeRow } from "@/server/repositories/internal-notice";

const CAP = 3;

const dateFmt = new Intl.DateTimeFormat("ko-KR", { year: "2-digit", month: "numeric", day: "numeric" });

export function InternalNotices({ notices, canManage }: { notices: InternalNoticeRow[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

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

      <div className="mt-3 space-y-1">
        {notices.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-surface/40 px-3 py-6 text-center text-xs text-slate-400">
            등록된 내부 공지가 없습니다.{canManage ? " ‘작성’으로 첫 공지를 올려보세요." : ""}
          </p>
        ) : (
          notices.slice(0, showAll ? notices.length : CAP).map((n) => (
            <div key={n.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface" title={n.body}>
              {n.pinned && <Pin className="h-3 w-3 shrink-0 text-brand" />}
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{n.title}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{dateFmt.format(new Date(n.createdAt))}</span>
              {canManage && (
                <button type="button" onClick={() => remove(n.id)} disabled={busyId === n.id} className="shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500" aria-label="삭제">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {notices.length > CAP && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 flex w-full items-center justify-center gap-0.5 rounded-lg border border-line py-1.5 text-[11px] font-semibold text-brand hover:bg-surface">
          {showAll ? "접기" : `더보기 (${notices.length - CAP}건 더)`} <ArrowRight className={`h-3 w-3 transition ${showAll ? "-rotate-90" : ""}`} />
        </button>
      )}
    </section>
  );
}
