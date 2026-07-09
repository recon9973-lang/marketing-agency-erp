"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type MyNotifications
} from "@/server/actions/notifications";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const POLL_MS = 45_000;

export function NotificationBell() {
  const router = useRouter();
  const [data, setData] = useState<MyNotifications>({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await getMyNotifications());
    } catch {
      /* 폴링 실패는 조용히 무시 */
    }
  }, []);

  // 최초 로드 + 주기적 폴링(서버리스라 실시간 대신 가벼운 폴링).
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  // 바깥 클릭 시 닫기.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function onItem(id: string, link: string | null, isRead: boolean) {
    if (!isRead) {
      await markNotificationRead({ id });
      refresh();
    }
    setOpen(false);
    if (link) router.push(link as never);
  }

  async function onMarkAll() {
    await markAllNotificationsRead();
    refresh();
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-slate-600 hover:bg-white"
        aria-label="알림"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
        {data.unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <span className="text-sm font-bold text-ink">알림</span>
            {data.unread > 0 ? (
              <button type="button" onClick={onMarkAll} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong hover:underline">
                <Check className="h-3.5 w-3.5" /> 모두 읽음
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data.items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-500">새 알림이 없습니다.</p>
            ) : (
              data.items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onItem(n.id, n.link, n.isRead)}
                  className={
                    "block w-full border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-surface " +
                    (n.isRead ? "" : "bg-brand-soft/40")
                  }
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead ? <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" /> : <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{n.title}</p>
                      {n.body ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p> : null}
                      <p className="mt-0.5 text-[11px] text-slate-400">{dateFmt.format(new Date(n.createdAt))}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
