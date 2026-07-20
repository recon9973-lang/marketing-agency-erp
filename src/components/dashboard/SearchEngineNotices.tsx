// 대시보드 위젯 — 검색엔진(구글·네이버) 공식 공지. 서버 컴포넌트에서 피드를 받아
// 렌더한다. 피드 로딩이 느려도 대시보드를 막지 않도록 Suspense로 감싸 사용한다.
import Link from "next/link";
import { Megaphone, ExternalLink, ArrowRight } from "lucide-react";
import { getSearchNotices, type NoticeSource } from "@/server/integrations/search-notices";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { year: "2-digit", month: "numeric", day: "numeric" });

const SOURCE_STYLE: Record<NoticeSource, { dot: string; chip: string; label: string }> = {
  google: { dot: "#4285F4", chip: "text-[#1a73e8] bg-[#4285F4]/10", label: "Google" },
  naver: { dot: "#03C75A", chip: "text-[#03A54B] bg-[#03C75A]/12", label: "NAVER" }
};

export function SearchNoticesSkeleton() {
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-bold text-ink">검색엔진 공지</h2>
      </div>
      <div className="mt-3 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    </section>
  );
}

export async function SearchEngineNotices() {
  const { items: allItems, degraded } = await getSearchNotices(12);
  const items = allItems.slice(0, 3); // 3개까지만, 나머지는 ‘더보기’(/notices)

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-bold text-ink">검색엔진 공지</h2>
        <span className="text-[11px] text-slate-400">구글 · 네이버 공식</span>
        {degraded && (
          <span className="text-[10px] text-slate-400" title="실시간 피드를 불러오지 못했습니다. 공식 공지 페이지로 연결합니다.">
            공식 페이지 연결
          </span>
        )}
        <Link href="/notices" className="ml-auto flex items-center gap-0.5 text-[11px] font-semibold text-brand hover:underline">
          더보기 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <ul className="mt-3 space-y-1">
        {items.map((n, i) => {
          const s = SOURCE_STYLE[n.source];
          return (
            <li key={`${n.url}-${i}`}>
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface"
              >
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${s.chip}`}>{s.label}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink group-hover:text-brand">{n.title}</span>
                {n.date && <span className="shrink-0 text-[11px] tabular-nums text-slate-400">{dateFmt.format(new Date(n.date))}</span>}
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-brand" />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
