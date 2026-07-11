"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { lookupKeywordVolumeAction } from "@/server/actions/keywords";
import type { KeywordTrend } from "@/server/integrations/naver-datalab";
import type { KeywordVolume } from "@/server/integrations/naver-search";

const numberFormatter = new Intl.NumberFormat("ko-KR");

function formatCount(value: number | null) {
  return value == null ? "—" : numberFormatter.format(value);
}

function VolumeTable({ rows }: { rows: KeywordVolume[] }) {
  const anyEstimated = rows.some((row) => row.estimated);
  return (
    <>
      <div className="overflow-hidden rounded-md border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface/60 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">키워드</th>
                <th className="px-4 py-2 text-right font-medium">PC</th>
                <th className="px-4 py-2 text-right font-medium">모바일</th>
                <th className="px-4 py-2 text-right font-medium">합계(월간)</th>
                <th className="px-4 py-2 font-medium">경쟁</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.keyword} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-medium text-ink">
                    {row.keyword}
                    {row.estimated ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        데모 추정
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">{formatCount(row.pc)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-700">{formatCount(row.mobile)}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-ink">{formatCount(row.total)}</td>
                  <td className="px-4 py-2 text-slate-600">{row.competition ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {anyEstimated ? (
        <p className="text-xs text-slate-400">
          ※ ‘데모 추정’은 실제 검색량이 아닙니다. 네이버 검색광고 API 키를 설정하면 실제 월간 검색수로 바뀝니다.
        </p>
      ) : null}
    </>
  );
}

function TrendCard({ item }: { item: KeywordTrend }) {
  const delta = item.delta ?? 0;
  const deltaLabel =
    item.delta == null ? "" : item.delta > 0 ? `▲ ${item.delta}` : item.delta < 0 ? `▼ ${Math.abs(item.delta)}` : "–";
  const deltaColor = delta > 0 ? "text-brand" : delta < 0 ? "text-danger" : "text-slate-400";

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate font-medium text-ink">{item.keyword}</p>
        <span className={`shrink-0 text-xs font-semibold ${deltaColor}`}>{deltaLabel}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-ink">{item.latestRatio ?? "—"}</span>
        <span className="text-xs text-slate-400">/ 100 (최근)</span>
      </div>
      {item.points.length > 0 ? (
        <div className="mt-3 flex h-16 items-end gap-1">
          {item.points.map((point) => (
            <div key={point.period} className="flex-1" title={`${point.period.slice(0, 7)} · ${Math.round(point.ratio)}`}>
              <div
                className="w-full rounded-t bg-brand/70"
                style={{ height: `${Math.max(4, (point.ratio / (item.peakRatio || 100)) * 100)}%` }}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">데이터가 없습니다.</p>
      )}
      <p className="mt-1 text-right text-[10px] text-slate-400">최근 6개월 · 상대 트렌드</p>
    </div>
  );
}

export function KeywordLookup() {
  const [state, formAction, pending] = useActionState(lookupKeywordVolumeAction, null);
  const data = state?.ok ? state.data : null;

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-2 rounded-2xl border border-line bg-white p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          <span>키워드 (쉼표 또는 줄바꿈으로 구분, 최대 5개)</span>
          <textarea
            name="keywords"
            rows={2}
            required
            maxLength={300}
            placeholder="예: 강남치과, 임플란트 가격, 스케일링"
            className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "조회 중…" : "검색량 조회"}
          </Button>
          {state && !state.ok ? <p className="text-xs text-danger">{state.error.message}</p> : null}
        </div>
      </form>

      {data?.mode === "trend" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.trend.map((item) => (
            <TrendCard key={item.keyword} item={item} />
          ))}
        </div>
      ) : data?.mode === "volume" && data.volume.length > 0 ? (
        <VolumeTable rows={data.volume} />
      ) : null}
    </div>
  );
}
