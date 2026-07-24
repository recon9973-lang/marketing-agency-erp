"use client";

/**
 * 마케팅 전략 — 병원+지역+진료과 입력 → 수주 진단(대응 방향) + 키워드 실측.
 * 상권분석(/market)과 별개 트랙. 상권 데이터를 근거로 소비하되 여기서만 전략을 다룬다.
 */
import { useState, useTransition } from "react";
import { analyzeMarketingStrategy, type MarketingStrategy } from "@/server/actions/strategy";
import { ConsultingReviewPanel } from "@/components/insights/ConsultingReviewPanel";

const SPECIALTIES = [
  "", "내과", "정형외과", "성형외과", "피부과", "이비인후과", "안과", "산부인과", "소아청소년과",
  "치과", "정신건강의학과", "재활의학과", "비뇨의학과", "가정의학과", "신경과", "외과", "마취통증의학과",
  "한의원", "한방병원"
];

function fmt(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("ko-KR");
}

const CARD = "rounded-2xl border border-line bg-card p-4";
const INPUT = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export function StrategyAnalysis({ presetRegion = "", presetSpecialty = "" }: { presetRegion?: string; presetSpecialty?: string }) {
  const [brand, setBrand] = useState("");
  const [region, setRegion] = useState(presetRegion);
  const [specialty, setSpecialty] = useState(presetSpecialty);
  const [res, setRes] = useState<MarketingStrategy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    const q = region.trim();
    if (!q) {
      setError("지역(주소 또는 구)을 입력하세요.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await analyzeMarketingStrategy({ brand: brand || null, region: q, specialty: specialty || null });
      if (r.ok) setRes(r.data);
      else setError(r.error.message);
    });
  }

  const kw = res?.keywords;

  return (
    <div className="space-y-4">
      {/* 입력 */}
      <div className={CARD}>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_180px_auto]">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">병원명(브랜드)</label>
            <input className={INPUT} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="예) 참사랑한의원" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">지역(주소·구)</label>
            <input className={INPUT} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="예) 대구 달서구" onKeyDown={(e) => e.key === "Enter" && run()} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">진료과</label>
            <select className={INPUT} value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
              {SPECIALTIES.map((s) => <option key={s} value={s}>{s || "(선택)"}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={run} disabled={pending} className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
              {pending ? "분석 중…" : "전략 분석"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">상권분석 실측을 근거로 수주 매력도·진입 대응 방향과 키워드 실측을 생성합니다. 상권 데이터 자체는 상권분석 화면에서 확인하세요.</p>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20">{error}</div>}

      {res && (
        <>
          {!res.resolved && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20">
              지역을 특정하지 못했습니다(구·동까지 입력 시 정확). 키워드 실측은 아래에 표시됩니다.
            </div>
          )}

          {/* 수주 진단 */}
          {res.acquisition && (
            <ConsultingReviewPanel
              review={res.acquisition.review}
              markdown={res.acquisition.markdown}
              region={res.regionLabel}
              departments={res.specialty ? [res.specialty] : []}
              title="신규 수주 진단"
              subtitle="상권 기회와 진입 대응 방향"
            />
          )}

          {/* 키워드 실측 */}
          <div className={CARD}>
            <h3 className="text-sm font-bold text-ink">🔎 키워드 실측 <span className="font-normal text-slate-400">지역+진료과 · 검색량·경쟁·포화도</span></h3>
            {kw && (
              <>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <span className={kw.searchConnected ? "text-emerald-500" : "text-amber-500"}>{kw.searchConnected ? "✅ 검색량 실측(네이버 검색광고)" : "🟡 검색량 미연동(데모)"}</span>
                  <span className={kw.blogConnected ? "text-emerald-500" : "text-amber-500"}>{kw.blogConnected ? "✅ 포화도 실측(네이버 블로그)" : "🟡 포화도 미연동"}</span>
                </div>
                {kw.rows.length > 0 ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-[12.5px]">
                      <thead>
                        <tr className="border-b border-line text-left text-[11px] text-slate-400">
                          <th className="pb-2 pr-3 font-semibold">키워드</th>
                          <th className="px-2 pb-2 text-right font-semibold">PC</th>
                          <th className="px-2 pb-2 text-right font-semibold">Mobile</th>
                          <th className="px-2 pb-2 text-right font-semibold">합계</th>
                          <th className="px-2 pb-2 text-center font-semibold">경쟁도</th>
                          <th className="px-2 pb-2 text-right font-semibold">블로그</th>
                          <th className="px-2 pb-2 text-center font-semibold">포화도</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kw.rows.map((r) => (
                          <tr key={r.keyword} className="border-b border-line/60">
                            <td className="py-2 pr-3 font-medium text-ink">
                              {r.seed && <span className="mr-1 text-[10px] text-brand">●</span>}{r.keyword}
                            </td>
                            <td className="px-2 text-right tabular-nums text-slate-500">{fmt(r.pc)}</td>
                            <td className="px-2 text-right tabular-nums text-slate-500">{fmt(r.mobile)}</td>
                            <td className="px-2 text-right font-semibold tabular-nums text-ink">{fmt(r.total)}</td>
                            <td className="px-2 text-center text-slate-500">{r.competition ?? "—"}</td>
                            <td className="px-2 text-right tabular-nums text-slate-500">{fmt(r.blogDocs)}</td>
                            <td className="px-2 text-center">
                              {r.saturation ? (
                                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${r.saturation === "과열" ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300" : r.saturation === "여유" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300"}`}>{r.saturation}</span>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-[10.5px] text-slate-400">● 지역 대표 키워드(시드) · 포화도 = 블로그 발행량 대비 검색수요(과열=콘텐츠 경쟁 심함). 검색량 낮아도 경쟁 과열이면 점유 확보 필요.</p>
                  </div>
                ) : (
                  <p className="mt-3 text-[12.5px] text-slate-400">키워드 결과가 없습니다(진료과 선택 시 정확도 상승).</p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
