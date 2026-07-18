// GEO CEP · 상위 URL 분석 — 리스닝마인드 '상위 URL 분석'(슬라이드 12) 재현.
// SearchDataPort.serpTop 결과를 표로. 목=근사, 네이버 키 설정 시 실측으로 자동 승격(P2).
import type { SerpDoc } from "@/server/geo-studio/providers/port";
import type { DataTier } from "@/server/geo-studio/providers/port";
import { TierBadge } from "@/components/geo-common/TierBadge";

export function SerpTable({ docs, tier, keyword }: { docs: SerpDoc[]; tier: DataTier; keyword: string }) {
  if (!docs.length) return null;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <div className="flex items-center gap-2 px-4 pt-4">
        <p className="text-sm font-bold text-ink">상위 URL 분석 — “{keyword}”</p>
        <TierBadge tier={tier} note={tier === "measured" ? "네이버 실측" : "목 파이프라인"} />
      </div>
      <p className="px-4 text-[11px] text-slate-400">진입점 상위 노출 콘텐츠 — 콘텐츠 벤치마킹·SERP 선점 대상</p>
      <table className="mt-2 w-full min-w-[560px] border-collapse text-left text-sm">
        <thead className="border-y border-line bg-surface text-xs font-semibold text-slate-500">
          <tr>
            <th className="px-4 py-2 w-10">#</th>
            <th className="px-2 py-2">제목 · URL</th>
            <th className="px-2 py-2 w-16">출처</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.rank} className="border-t border-line align-top">
              <td className="px-4 py-2 font-semibold text-slate-400">{d.rank}</td>
              <td className="px-2 py-2">
                <p className="font-medium text-ink">{d.title}</p>
                <p className="truncate text-[11px] text-emerald-700">{d.url}</p>
                {d.snippet ? <p className="mt-0.5 text-[11px] text-slate-500">{d.snippet}</p> : null}
              </td>
              <td className="px-2 py-2 text-[11px] text-slate-400">{d.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
