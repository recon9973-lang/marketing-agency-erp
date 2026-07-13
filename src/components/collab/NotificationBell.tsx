"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BriefcaseBusiness, Check, CircleCheck, MessageCircle, Plane, TrendingDown } from "lucide-react";
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type MyNotifications
} from "@/server/actions/notifications";
import {
  classifyNotification, NOTIF_CATEGORY_LABEL, NOTIF_CATEGORY_ORDER,
  type NotifCategory, type NotifIcon, type NotifTone
} from "@/domain/notifications";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const POLL_MS = 60_000;

const TONE_STYLE: Record<NotifTone, string> = {
  rose: "bg-rose-100 text-rose-600",
  amber: "bg-amber-100 text-amber-600",
  blue: "bg-blue-100 text-blue-600",
  violet: "bg-violet-100 text-violet-600",
  emerald: "bg-emerald-100 text-emerald-600",
  slate: "bg-slate-100 text-slate-500"
};

const ICON: Record<NotifIcon, typeof Bell> = {
  rank: TrendingDown,
  confirm: CircleCheck,
  client: BriefcaseBusiness,
  collab: MessageCircle,
  hr: Plane,
  system: Bell
};

export function NotificationBell() {
  const router = useRouter();
  const [data, setData] = useState<MyNotifications>({ items: [], unread: 0 });
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<NotifCategory | "ALL">("ALL");
  const boxRef = useRef<HTMLDivElement | null>(null);

  // 로드된 알림에 카테고리 메타를 붙이고, 카테고리별 개수를 센다(필터 탭·아이콘용).
  const decorated = useMemo(() => data.items.map((n) => ({ n, meta: classifyNotification(n.type) })), [data.items]);
  const countByCat = useMemo(() => {
    const m = new Map<NotifCategory, number>();
    for (const { meta } of decorated) m.set(meta.category, (m.get(meta.category) ?? 0) + 1);
    return m;
  }, [decorated]);
  const visible = useMemo(() => (cat === "ALL" ? decorated : decorated.filter((d) => d.meta.category === cat)), [decorated, cat]);

  // 배지용 — 읽지 않은 개수만 가볍게(단일 쿼리). 목록은 열 때만 로드.
  const refreshCount = useCallback(async () => {
    try {
      const unread = await getUnreadNotificationCount();
      setData((d) => ({ ...d, unread }));
    } catch {
      /* 폴링 실패는 조용히 무시 */
    }
  }, []);

  const loadList = useCallback(async () => {
    try {
      setData(await getMyNotifications());
      setLoaded(true);
    } catch {
      /* 무시 */
    }
  }, []);

  // 최초 개수 로드 + 탭이 보일 때만 주기적 폴링(백그라운드 부하 절감).
  useEffect(() => {
    refreshCount();
    const t = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") refreshCount();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [refreshCount]);

  // 드롭다운을 처음 열 때 목록을 가져온다.
  useEffect(() => {
    if (open && !loaded) loadList();
  }, [open, loaded, loadList]);

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
      loadList();
    }
    setOpen(false);
    if (link) router.push(link as never);
  }

  async function onMarkAll() {
    await markAllNotificationsRead();
    loadList();
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
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <span className="text-sm font-bold text-ink">알림</span>
            {data.unread > 0 ? (
              <button type="button" onClick={onMarkAll} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong hover:underline">
                <Check className="h-3.5 w-3.5" /> 모두 읽음
              </button>
            ) : null}
          </div>

          {/* 카테고리 필터 — 로드된 알림에 존재하는 종류만 노출. */}
          {decorated.length > 0 ? (
            <div className="flex flex-wrap gap-1 border-b border-line px-2.5 py-2">
              <FilterChip active={cat === "ALL"} onClick={() => setCat("ALL")} label="전체" count={decorated.length} />
              {NOTIF_CATEGORY_ORDER.filter((c) => (countByCat.get(c) ?? 0) > 0).map((c) => (
                <FilterChip key={c} active={cat === c} onClick={() => setCat(c)} label={NOTIF_CATEGORY_LABEL[c]} count={countByCat.get(c) ?? 0} />
              ))}
            </div>
          ) : null}

          <div className="max-h-96 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-500">{decorated.length === 0 ? "새 알림이 없습니다." : "이 종류의 알림이 없습니다."}</p>
            ) : (
              visible.map(({ n, meta }) => {
                const Icon = ICON[meta.icon];
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onItem(n.id, n.link, n.isRead)}
                    className={
                      "block w-full border-b border-line px-3 py-2.5 text-left last:border-0 hover:bg-surface " +
                      (n.isRead ? "" : "bg-brand-soft/40")
                    }
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_STYLE[meta.tone]}`}>
                        <Icon className="h-4 w-4" strokeWidth={1.9} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-ink">{n.title}</p>
                          {!n.isRead ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" /> : null}
                        </div>
                        {n.body ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p> : null}
                        <p className="mt-0.5 text-[11px] text-slate-400">{NOTIF_CATEGORY_LABEL[meta.category]} · {dateFmt.format(new Date(n.createdAt))}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition " +
        (active ? "bg-brand text-white" : "bg-surface text-slate-500 hover:bg-white hover:text-ink")
      }
    >
      {label} {count}
    </button>
  );
}
