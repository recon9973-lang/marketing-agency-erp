"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { lookupKeywordVolumeAction } from "@/server/actions/keywords";

const numberFormatter = new Intl.NumberFormat("ko-KR");

function formatCount(value: number | null) {
  return value == null ? "—" : numberFormatter.format(value);
}

export function KeywordLookup() {
  const [state, formAction, pending] = useActionState(lookupKeywordVolumeAction, null);

  const results = state?.ok ? state.data.results : [];
  const anyEstimated = results.some((row) => row.estimated);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-2 rounded-md border border-line bg-white p-4">
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

      {results.length > 0 ? (
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
                {results.map((row) => (
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
      ) : null}

      {anyEstimated ? (
        <p className="text-xs text-slate-400">
          ※ ‘데모 추정’은 실제 검색량이 아닙니다. 네이버 검색광고 API 키를 설정하면 실제 월간 검색수로 바뀝니다.
        </p>
      ) : null}
    </div>
  );
}
