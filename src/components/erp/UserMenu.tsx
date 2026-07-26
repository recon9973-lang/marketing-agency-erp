"use client";

/**
 * 헤더 사용자 아바타 — 클릭 시 "내 정보" 모달(보기 + 계정 수정 + 로그아웃 + 화면 안내).
 * 최고관리자 등 역할 아바타가 클릭되지 않던 문제 해결.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, KeyRound, X, Sun, Bell, Search } from "lucide-react";
import { logout } from "@/server/actions/logout";

export function UserMenu({ name, email, roleLabel }: { name: string; email: string; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const initial = (roleLabel || name || "?").charAt(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="내 정보"
        aria-label="내 정보 열기"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-strong transition hover:ring-2 hover:ring-brand/40"
      >
        {initial}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16 sm:pt-20"
          role="dialog"
          aria-modal="true"
          aria-label="내 정보"
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-lg font-bold text-brand-strong">{initial}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{name || "이름 미설정"}</p>
                  <p className="truncate text-xs text-slate-500">{email || "이메일 미설정"}</p>
                  <span className="mt-1 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-semibold text-brand-strong">{roleLabel}</span>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="닫기" className="rounded-md p-1 text-slate-400 transition hover:bg-surface/60 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-surface/60 dark:text-slate-200"
              >
                <KeyRound className="h-4 w-4 text-brand" /> 내 정보 · 비밀번호 수정
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="inline-flex w-full items-center gap-2 rounded-lg border border-rose-200 bg-card px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-950/20"
                >
                  <LogOut className="h-4 w-4" /> 로그아웃
                </button>
              </form>
            </div>

            <div className="mt-4 border-t border-line pt-3">
              <p className="text-[11px] font-semibold text-slate-400">화면 안내 — 상단 우측 버튼</p>
              <ul className="mt-1.5 space-y-1.5 text-[12px] text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2"><Sun className="h-3.5 w-3.5 text-slate-400" /> 테마 전환(라이트/다크)</li>
                <li className="flex items-center gap-2"><Bell className="h-3.5 w-3.5 text-slate-400" /> 알림 — 공지·결재·멘션</li>
                <li className="flex items-center gap-2"><Search className="h-3.5 w-3.5 text-slate-400" /> 전역 검색(⌘K) · <span className="text-slate-400">↩ 이동</span></li>
                <li className="flex items-center gap-2"><LogOut className="h-3.5 w-3.5 text-slate-400" /> 로그아웃</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
