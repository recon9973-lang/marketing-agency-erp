// 플랫폼 공지 배너 — 구글/네이버 업데이트를 한 개 배너에 순환 노출.
// 실시간성: 60초 폴링 + 창 포커스 시 재조회로 새 공지를 새로고침 없이 반영, NEW 뱃지 표시.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, ExternalLink, Megaphone } from "lucide-react";
import {
  CATEGORY_LABEL, PLATFORM_LABEL, isNewUpdate,
  type PlatformKind, type UpdateCategory
} from "@/domain/platform-updates";

type Update = {
  id: string;
  platform: PlatformKind;
  category: UpdateCategory;
  title: string;
  url: string | null;
  summary: string | null;
  source: string;
  publishedAt: string;
  pinned: boolean;
  isManual: boolean;
};

const POLL_MS = 60_000; // 폴링 주기(near-real-time)
const ROTATE_MS = 6_000; // 배너 항목 순환 주기
const SEEN_KEY = "platformUpdatesSeenAt";

const PLATFORM_STYLE: Record<PlatformKind, string> = {
  NAVER: "bg-emerald-100 text-emerald-700",
  GOOGLE: "bg-blue-100 text-blue-700",
  ETC: "bg-slate-100 text-slate-600"
};

function relativeTime(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, now - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function PlatformUpdateBanner() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [seenAt, setSeenAt] = useState(0);
  const pausedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/platform-updates", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { ok: boolean; updates?: Update[] };
      if (json.ok && Array.isArray(json.updates)) setUpdates(json.updates);
    } catch {
      /* 네트워크 일시 오류는 조용히 무시 — 다음 폴링에서 회복 */
    }
  }, []);

  // 최초 로드 + 폴링 + 창 포커스 시 재조회
  useEffect(() => {
    load();
    const poll = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // 상대시간·NEW 갱신용 틱
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // localStorage에서 마지막 확인 시각 복원
  useEffect(() => {
    const raw = Number(window.localStorage.getItem(SEEN_KEY) ?? 0);
    setSeenAt(Number.isFinite(raw) ? raw : 0);
  }, []);

  // 항목 수 변동 시 인덱스 보정
  useEffect(() => {
    setIdx((i) => (updates.length ? i % updates.length : 0));
  }, [updates.length]);

  // 자동 순환(마우스 오버 시 일시정지)
  useEffect(() => {
    if (updates.length <= 1) return;
    const t = setInterval(() => {
      if (!pausedRef.current) setIdx((i) => (i + 1) % updates.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [updates.length]);

  const unseenCount = useMemo(
    () => updates.filter((u) => new Date(u.publishedAt).getTime() > seenAt && isNewUpdate(u.publishedAt, now)).length,
    [updates, seenAt, now]
  );

  function markSeen() {
    const ts = Date.now();
    setSeenAt(ts);
    try {
      window.localStorage.setItem(SEEN_KEY, String(ts));
    } catch {
      /* 저장 실패 무시 */
    }
  }

  if (updates.length === 0) return null;

  const current = updates[Math.min(idx, updates.length - 1)];
  const isNew = isNewUpdate(current.publishedAt, now);
  const go = (delta: number) => setIdx((i) => (i + delta + updates.length) % updates.length);

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-line bg-white p-3.5 dark:bg-card"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      aria-label="플랫폼 공지"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
          <Megaphone className="h-[18px] w-[18px]" />
          {unseenCount > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500 ring-2 ring-white dark:ring-card" />}
        </span>

        <a
          href={current.url ?? undefined}
          target={current.url ? "_blank" : undefined}
          rel={current.url ? "noopener noreferrer" : undefined}
          className={`group flex min-w-0 flex-1 items-center gap-2 ${current.url ? "cursor-pointer" : "cursor-default"}`}
        >
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${PLATFORM_STYLE[current.platform]}`}>
            {PLATFORM_LABEL[current.platform]}
          </span>
          <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">
            {CATEGORY_LABEL[current.category]}
          </span>
          {isNew && <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">NEW</span>}
          {current.pinned && <span className="shrink-0 text-[11px] text-amber-500" title="고정됨">📌</span>}
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink group-hover:underline">{current.title}</span>
          {current.url && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-slate-500" />}
        </a>

        <span className="shrink-0 text-[11px] text-slate-400">{relativeTime(current.publishedAt, now)}</span>

        {updates.length > 1 && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" onClick={() => go(-1)} className="rounded-lg p-1 text-slate-400 transition hover:bg-surface hover:text-slate-600" aria-label="이전 공지">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[2.5rem] text-center text-[10.5px] tabular-nums text-slate-400">{idx + 1}/{updates.length}</span>
            <button type="button" onClick={() => go(1)} className="rounded-lg p-1 text-slate-400 transition hover:bg-surface hover:text-slate-600" aria-label="다음 공지">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {unseenCount > 0 && (
          <button
            type="button"
            onClick={markSeen}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-600 transition hover:bg-rose-100"
          >
            <Bell className="h-3.5 w-3.5" /> 새 공지 {unseenCount}
          </button>
        )}
      </div>
    </section>
  );
}
