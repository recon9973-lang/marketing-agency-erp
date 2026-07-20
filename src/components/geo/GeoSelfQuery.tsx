"use client";

// GEO 자체 조회 — 업체명 + 키워드만으로 즉시 스냅샷(키워드 확장·CEP·여정). 거래처 불필요.
import { useState, useTransition } from "react";
import { Search, Sparkles } from "lucide-react";
import { runGeoSelfQuery, type GeoSelfQueryResult } from "@/server/actions/geo-selfquery";
import { ClusterBubbleMap } from "@/components/geo-cep/ClusterBubbleMap";
import { JourneyGraph, type RawNode } from "@/components/geo-path/JourneyGraph";

const numberFormatter = new Intl.NumberFormat("ko-KR");
const inputCls = "w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500";

function Tier({ tier }: { tier: "measured" | "approx" | "demo" }) {
  const map = {
    measured: { label: "실측", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    approx: { label: "근사", cls: "border-sky-200 bg-sky-50 text-sky-700" },
    demo: { label: "데모", cls: "border-amber-200 bg-amber-50 text-amber-700" }
  }[tier];
  return <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${map.cls}`}>{map.label}</span>;
}

export function GeoSelfQuery({ presetBrand, presetKeyword }: { presetBrand?: string; presetKeyword?: string }) {
  const [brand, setBrand] = useState(presetBrand ?? "");
  const [keyword, setKeyword] = useState(presetKeyword ?? "");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GeoSelfQueryResult | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setError(null);
    if (!brand.trim() || !keyword.trim()) {
      setError("업체명과 키워드를 모두 입력해주세요.");
      return;
    }
    start(async () => {
      const res = await runGeoSelfQuery({ brand, keyword });
      if (!res.ok) {
        setError(res.error.message);
        setData(null);
        return;
      }
      setData(res.data);
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-800/50 dark:bg-emerald-950/30">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm font-bold text-ink">자체 조회 — 거래처 없이 빠르게</h3>
      </div>
      <p className="text-xs text-slate-500">
        계약 단계에서 이어받은 거래처가 없어도, 업체명과 키워드만 입력하면 키워드 확장·CEP 군집·검색 여정을 즉시 조회합니다.
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="업체명 (예: 서울퍼스트치과)" className={inputCls} />
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="키워드 (예: 임플란트)" className={inputCls} onKeyDown={(e) => e.key === "Enter" && run()} />
        <button type="button" onClick={run} disabled={pending} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          <Search className="h-4 w-4" /> {pending ? "조회 중…" : "자체 조회"}
        </button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {data && (
        <div className="space-y-4">
          {/* 키워드 확장 */}
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <h4 className="text-sm font-bold text-ink">키워드 · 연관키워드</h4>
              <Tier tier={data.keywordConnected ? "measured" : "demo"} />
              <span className="text-[11px] text-slate-400">상위 {data.keywords.length}개</span>
            </div>
            {data.keywords.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-slate-500">
                      <th className="px-2 py-1.5 font-medium">구분</th>
                      <th className="px-2 py-1.5 font-medium">키워드</th>
                      <th className="px-2 py-1.5 text-right font-medium">PC</th>
                      <th className="px-2 py-1.5 text-right font-medium">모바일</th>
                      <th className="px-2 py-1.5 text-right font-medium">합계(월)</th>
                      <th className="px-2 py-1.5 font-medium">경쟁</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.keywords.map((r) => (
                      <tr key={r.keyword} className="border-b border-line last:border-0">
                        <td className="px-2 py-1.5">
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${r.related ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"}`}>{r.related ? "연관" : "시드"}</span>
                        </td>
                        <td className="px-2 py-1.5 font-medium text-ink">{r.keyword}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{r.pc == null ? "—" : numberFormatter.format(r.pc)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{r.mobile == null ? "—" : numberFormatter.format(r.mobile)}</td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-ink">{r.total == null ? "—" : numberFormatter.format(r.total)}</td>
                        <td className="px-2 py-1.5 text-slate-600">{r.competition ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400">키워드 데이터가 없습니다. (검색광고 API 미연동 시 연관키워드는 표시되지 않습니다.)</p>
            )}
          </div>

          {/* CEP 군집 */}
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <h4 className="text-sm font-bold text-ink">CEP — 카테고리 진입점</h4>
              <Tier tier={data.cepTier} />
            </div>
            {data.cepNote ? <p className="mb-2 text-[11px] text-amber-600">{data.cepNote}</p> : null}
            {data.ceps.length > 0 ? (
              <ClusterBubbleMap ceps={data.ceps} seedLabel={data.keyword} />
            ) : (
              <p className="text-sm text-slate-400">군집 데이터가 없습니다.</p>
            )}
          </div>

          {/* 검색 여정 */}
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <h4 className="text-sm font-bold text-ink">검색 여정</h4>
              <Tier tier={data.journeyTier} />
              {data.journey ? <span className="text-[11px] text-slate-400">노드 {data.journey.total_nodes} · 브랜드 언급률 {data.journey.brand_mention_rate}%</span> : null}
            </div>
            {data.journey ? (
              <JourneyGraph tree={data.journey.tree as unknown as RawNode} primaryPath={data.journey.top_paths[0] ?? []} brand={data.brand} />
            ) : (
              <p className="text-sm text-slate-400">여정 데이터가 없습니다.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
