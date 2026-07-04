import Link from "next/link";
import type { InboxSummary } from "@/server/repositories/inbox";

const numberFormatter = new Intl.NumberFormat("ko-KR");

/** 대시보드 하단 '바로가기 현황' — 메시지·보관함·플레이스 순위로 바로 이동. */
export function DashboardInbox({ inbox }: { inbox: InboxSummary }) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">바로가기 현황</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/messages"
          className="flex items-center justify-between rounded-md border border-line bg-white p-4 transition hover:border-brand"
        >
          <div>
            <p className="text-sm text-slate-500">안읽은 메시지</p>
            <p className="mt-1 text-2xl font-bold text-ink">{numberFormatter.format(inbox.unreadMessages)}</p>
          </div>
          <span className="text-2xl">💬</span>
        </Link>

        <Link
          href="/vault"
          className="flex items-center justify-between rounded-md border border-line bg-white p-4 transition hover:border-brand"
        >
          <div className="min-w-0">
            <p className="text-sm text-slate-500">보관함 파일</p>
            <p className="mt-1 text-2xl font-bold text-ink">{numberFormatter.format(inbox.vaultFileCount)}</p>
            {inbox.latestVaultFileName ? (
              <p className="mt-0.5 truncate text-xs text-slate-400">최근: {inbox.latestVaultFileName}</p>
            ) : null}
          </div>
          <span className="text-2xl">🗂️</span>
        </Link>

        <div className="rounded-md border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">최근 플레이스 순위</p>
            <span className="text-2xl">📍</span>
          </div>
          {inbox.recentRanks.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {inbox.recentRanks.map((rank) => (
                <li key={`${rank.clientId}-${rank.keyword}-${rank.recordedOn}`}>
                  <Link
                    href={`/clients/${rank.clientId}/ranks`}
                    className="flex items-center justify-between gap-2 text-sm hover:text-brand"
                  >
                    <span className="min-w-0 truncate text-slate-600">
                      {rank.clientName} · {rank.keyword}
                    </span>
                    <span className="shrink-0 font-semibold text-ink">{rank.rank}위</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">기록된 순위가 없습니다.</p>
          )}
        </div>
      </div>
    </section>
  );
}
