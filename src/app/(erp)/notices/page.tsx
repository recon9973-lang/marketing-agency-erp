// 검색엔진 공지 전용 페이지 — 대시보드 위젯의 "더보기"에서 진입. 구글·네이버
// 공식 공지를 더 많이(피드당 최대 15개) 모아 최신순으로 본다. 인증은 (erp) 레이아웃 담당.
import Link from "next/link";
import { Megaphone, ExternalLink, ArrowLeft } from "lucide-react";
import { getSearchNotices, type NoticeSource } from "@/server/integrations/search-notices";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" });

const SOURCE_STYLE: Record<NoticeSource, { chip: string; label: string }> = {
  google: { chip: "text-[#1a73e8] bg-[#4285F4]/10", label: "Google" },
  naver: { chip: "text-[#03A54B] bg-[#03C75A]/12", label: "NAVER" }
};

export default async function NoticesPage() {
  const { items, degraded } = await getSearchNotices(40, 15);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-brand">
          <ArrowLeft className="h-3.5 w-3.5" /> 대시보드
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-brand" />
          <h1 className="text-lg font-bold text-ink">검색엔진 공지</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          구글(Search Central · 검색 상태) · 네이버 공식 공지를 한 곳에서. 1시간마다 자동 갱신됩니다.
        </p>
      </div>

      {degraded && (
        <div className="rounded-xl border border-line bg-surface px-4 py-3 text-xs text-slate-500">
          실시간 피드를 불러오지 못해 각 검색엔진의 <b>공식 공지 페이지 링크</b>로 안내합니다.
        </div>
      )}

      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
        {items.map((n, i) => {
          const s = SOURCE_STYLE[n.source];
          return (
            <li key={`${n.url}-${i}`}>
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 px-4 py-3 hover:bg-surface"
              >
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${s.chip}`}>{s.label}</span>
                <span className="min-w-0 flex-1 text-sm text-ink group-hover:text-brand">{n.title}</span>
                {n.date && <span className="shrink-0 text-xs tabular-nums text-slate-400">{dateFmt.format(new Date(n.date))}</span>}
                <ExternalLink className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-brand" />
              </a>
            </li>
          );
        })}
      </ul>

      <p className="text-center text-[11px] text-slate-400">
        출처: Google Search Central · Google Search Status · 네이버 검색 공식 채널 · 참고용(순위 보장 아님)
      </p>
    </div>
  );
}
