// src/components/insta/InstaManager.tsx
//
// 인스타 관리 UI — 계정 추가/토글 + 발행 예약(캐러셀 최대 10장) + 큐(예약/발행/실패) + 즉시 발행.
// 토큰 원문은 다루지 않는다(환경변수 이름 tokenRef만 입력) → 실제 토큰은 배포 환경변수에 등록.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addInstagramAccount, toggleInstagramAccount, saveInstagramPost,
  publishInstagramPostNow, deleteInstagramPost
} from "@/server/actions/instagram";
import type { InstaAccountRow, InstaPostRow } from "@/server/repositories/instagram";

const input = "w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none";
const primary = "rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50";
const ghost = "rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-surface disabled:opacity-50";

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "초안", cls: "bg-slate-100 text-slate-600" },
  QUEUED: { label: "예약", cls: "bg-amber-100 text-amber-700" },
  PUBLISHED: { label: "발행완료", cls: "bg-emerald-100 text-emerald-700" },
  FAILED: { label: "실패", cls: "bg-rose-100 text-rose-700" }
};

export function InstaManager({ accounts, posts }: { accounts: InstaAccountRow[]; posts: InstaPostRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // 계정 폼
  const [acc, setAcc] = useState({ name: "", handle: "", igBusinessId: "", tokenRef: "INSTAGRAM_ACCESS_TOKEN" });
  // 발행 폼
  const [form, setForm] = useState({ accountId: accounts[0]?.id ?? "", caption: "", images: "", scheduledAt: "" });

  function run(p: Promise<{ ok: boolean; error?: string }>, ok: string) {
    setMsg(null);
    start(async () => {
      const r = await p;
      setMsg(r.ok ? ok : `오류: ${r.error ?? "실패"}`);
      if (r.ok) router.refresh();
    });
  }

  function submitAccount() {
    if (!acc.name || !acc.handle || !acc.igBusinessId || !acc.tokenRef) { setMsg("계정 정보를 모두 입력하세요"); return; }
    run(addInstagramAccount(acc), "계정 추가됨");
    setAcc({ name: "", handle: "", igBusinessId: "", tokenRef: "INSTAGRAM_ACCESS_TOKEN" });
  }

  function submitPost() {
    const images = form.images.split(/\s+/).map((s) => s.trim()).filter(Boolean);
    if (!form.accountId || !form.caption || images.length === 0) { setMsg("계정·캡션·이미지 URL을 입력하세요"); return; }
    run(saveInstagramPost({
      accountId: form.accountId, caption: form.caption, images,
      scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null
    }), form.scheduledAt ? "예약 등록됨" : "초안 저장됨");
    setForm({ ...form, caption: "", images: "", scheduledAt: "" });
  }

  return (
    <div className="space-y-6">
      {msg && <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-slate-700">{msg}</div>}

      {/* 계정 */}
      <section className="rounded-2xl border border-line bg-card p-4">
        <p className="text-sm font-bold text-ink">발행 계정</p>
        <p className="mt-0.5 text-[11px] text-slate-400">토큰 원문은 저장하지 않습니다 — 토큰이 담긴 <b>환경변수 이름</b>만 등록하고, 실제 토큰 값은 배포 환경변수(Vercel)에 넣으세요.</p>
        <div className="mt-3 space-y-2">
          {accounts.length === 0 && <p className="text-xs text-slate-500">등록된 계정이 없습니다. 아래에서 추가하세요.</p>}
          {accounts.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2">
              <div className="text-sm">
                <span className="font-semibold text-ink">{a.name}</span>
                <span className="ml-2 text-slate-500">@{a.handle}</span>
                <span className="ml-2 text-[11px] text-slate-400">ID {a.igBusinessId} · {a.tokenRef}</span>
                <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-semibold ${a.configured ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{a.configured ? "토큰 OK" : "토큰 미설정"}</span>
              </div>
              <button className={ghost} disabled={pending} onClick={() => run(toggleInstagramAccount({ id: a.id, active: !a.active }), "변경됨")}>{a.active ? "사용중" : "중지됨"}</button>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input className={input} placeholder="표시명(GROUND)" value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} />
          <input className={input} placeholder="핸들(ground_geo)" value={acc.handle} onChange={(e) => setAcc({ ...acc, handle: e.target.value })} />
          <input className={input} placeholder="비즈니스 ID(178414...)" value={acc.igBusinessId} onChange={(e) => setAcc({ ...acc, igBusinessId: e.target.value })} />
          <input className={input} placeholder="토큰 환경변수명" value={acc.tokenRef} onChange={(e) => setAcc({ ...acc, tokenRef: e.target.value })} />
        </div>
        <div className="mt-2 flex justify-end"><button className={primary} disabled={pending} onClick={submitAccount}>계정 추가</button></div>
      </section>

      {/* 발행 예약 */}
      <section className="rounded-2xl border border-line bg-card p-4">
        <p className="text-sm font-bold text-ink">발행 예약 · 즉시 발행</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select className={input} value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
            <option value="">계정 선택</option>
            {accounts.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.name} (@{a.handle})</option>)}
          </select>
          <input className={input} type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
        </div>
        <textarea className={`${input} mt-2 h-24 resize-y`} placeholder="캡션(≤2200자)" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
        <textarea className={`${input} mt-2 h-20 resize-y`} placeholder="이미지 공개 URL — 줄바꿈/공백으로 구분(1장=단일, 2~10장=캐러셀)" value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} />
        <div className="mt-2 flex justify-end gap-2">
          <span className="mr-auto self-center text-[11px] text-slate-400">예약시각을 비우면 초안으로 저장됩니다.</span>
          <button className={primary} disabled={pending} onClick={submitPost}>{form.scheduledAt ? "예약 등록" : "초안 저장"}</button>
        </div>
      </section>

      {/* 큐 */}
      <section className="rounded-2xl border border-line bg-card p-4">
        <p className="text-sm font-bold text-ink">발행 큐 · 기록 ({posts.length})</p>
        <div className="mt-3 space-y-2">
          {posts.length === 0 && <p className="text-xs text-slate-500">아직 발행분이 없습니다.</p>}
          {posts.map((p) => {
            const st = STATUS[p.status] ?? STATUS.DRAFT;
            return (
              <div key={p.id} className="rounded-xl border border-line bg-surface px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                  <span className="text-sm font-semibold text-ink">{p.accountName}</span>
                  <span className="text-[11px] text-slate-400">{p.images.length}장</span>
                  {p.scheduledAt && <span className="text-[11px] text-slate-400">예약 {new Date(p.scheduledAt).toLocaleString("ko-KR")}</span>}
                  {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-emerald-600 hover:underline">게시물 ↗</a>}
                  <div className="ml-auto flex gap-2">
                    {p.status !== "PUBLISHED" && <button className={ghost} disabled={pending} onClick={() => run(publishInstagramPostNow({ id: p.id }), "발행됨")}>즉시 발행</button>}
                    {p.status !== "PUBLISHED" && <button className={ghost} disabled={pending} onClick={() => run(deleteInstagramPost({ id: p.id }), "삭제됨")}>삭제</button>}
                  </div>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{p.caption}</p>
                {p.error && <p className="mt-1 text-[11px] text-rose-600">{p.error}</p>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
