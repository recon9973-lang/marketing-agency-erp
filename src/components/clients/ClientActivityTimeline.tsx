import type { Route } from "next";
import Link from "next/link";
import type { ActivityItem } from "@/server/repositories/client-activity";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul"
});

/** 거래처 최근 활동(업무·보고서·순위·협업방)을 시간순으로. */
export function ClientActivityTimeline({ items }: { items: ActivityItem[] }) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <h2 className="text-sm font-semibold text-ink">최근 활동</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">아직 기록된 활동이 없습니다.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href as Route}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-surface"
              >
                <span className="shrink-0 text-xs font-medium text-slate-500">{item.kind}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{item.title}</span>
                {item.subtitle ? (
                  <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs text-slate-500">
                    {item.subtitle}
                  </span>
                ) : null}
                <span className="shrink-0 text-xs text-slate-400">{dateFormatter.format(item.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
