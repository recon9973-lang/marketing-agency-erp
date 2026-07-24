"use client";

/**
 * 마케팅 전략 — 병원+지역+진료과(+홈페이지 URL) 입력 → 수주 진단 + 키워드 실측 +
 * 홈페이지 검색·AI 노출 정밀진단 + 경쟁사 + 통합 제안 브리프.
 * 상권분석(/market)과 별개 트랙. 상권 데이터를 근거로 소비만.
 */
import { useState, useTransition } from "react";
import { analyzeMarketingStrategy, type MarketingStrategy } from "@/server/actions/strategy";
import { ConsultingReviewPanel } from "@/components/insights/ConsultingReviewPanel";
import { Copy, Check } from "lucide-react";

const SPECIALTIES = [
  "", "내과", "정형외과", "성형외과", "피부과", "이비인후과", "안과", "산부인과", "소아청소년과",
  "치과", "정신건강의학과", "재활의학과", "비뇨의학과", "가정의학과", "신경과", "외과", "마취통증의학과",
  "한의원", "한방병원"
];

function fmt(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("ko-KR");
}
function scoreTone(n: number): string {
  if (n >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (n >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

const CARD = "rounded-2xl border border-line bg-card p-4";
const INPUT = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export function StrategyAnalysis({ presetRegion = "", presetSpecialty = "" }: { presetRegion?: string; presetSpecialty?: string }) {
  const [brand, setBrand] = useState("");
  const [region, setRegion] = useState(presetRegion);
  const [specialty, setSpecialty] = useState(presetSpecialty);
  const [url, setUrl] = useState("");
  const [res, setRes] = useState<MarketingStrategy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  function run() {
    const q = region.trim();
    if (!q) {
      setError("지역(주소 또는 구)을 입력하세요.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await analyzeMarketingStrategy({ brand: brand || null, region: q, specialty: specialty || null, url: url || null });
      if (r.ok) setRes(r.data);
      else setError(r.error.message);
    });
  }

  async function copyBrief() {
    if (!res) return;
    try {
      await navigator.clipboard.writeText(res.brief);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 클립보드 차단 — 무시 */
    }
  }

  const kw = res?.keywords;
  const seo = res?.seo;

  return (
    <div className="space-y-4">
      {/* 입력 */}
      <div className={CARD}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_150px_1fr_auto]">
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
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">홈페이지 URL <span className="text-slate-400">(선택)</span></label>
            <input className={INPUT} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="예) https://..." onKeyDown={(e) => e.key === "Enter" && run()} />
          </div>
          <div className="flex items-end">
            <button onClick={run} disabled={pending} className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
              {pending ? "분석 중…" : "전략 분석"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">상권 실측을 근거로 수주 진단·키워드·정밀진단·경쟁사를 종합합니다. URL을 넣으면 홈페이지 검색·AI 노출 점수·처방까지 실측. 상권 데이터 자체는 상권분석 화면에서 확인하세요.</p>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20">{error}</div>}

      {res && (
        <>
          {/* 통합 브리프 복사 */}
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface/50 px-4 py-2.5">
            <span className="text-[12.5px] font-semibold text-slate-500">📄 4개 실측 블록 종합 — 통합 제안 브리프</span>
            <button onClick={copyBrief} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-surface/60 dark:text-slate-300">
              {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> 복사됨</> : <><Copy className="h-3.5 w-3.5" /> 브리프 복사</>}
            </button>
          </div>

          {!res.resolved && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20">
              지역을 특정하지 못했습니다(구·동까지 입력 시 정확). 키워드·정밀진단·경쟁사는 아래에 표시됩니다.
            </div>
          )}

          {/* ① 수주 진단 */}
          {res.acquisition && (
            <ConsultingReviewPanel
              review={res.acquisition.review}
              markdown={res.acquisition.markdown}
              region={res.regionLabel}
              departments={res.specialty ? [res.specialty] : []}
              title="① 신규 수주 진단"
              subtitle="상권 기회와 진입 대응 방향"
            />
          )}

          {/* ② 키워드 실측 */}
          <div className={CARD}>
            <h3 className="text-sm font-bold text-ink">② 키워드 실측 <span className="font-normal text-slate-400">검색량·경쟁·포화도</span></h3>
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
                    <p className="mt-2 text-[10.5px] text-slate-400">● 지역 대표 키워드(시드) · 포화도 = 블로그 발행량 대비 검색수요(과열=콘텐츠 경쟁 심함).</p>
                  </div>
                ) : (
                  <p className="mt-3 text-[12.5px] text-slate-400">키워드 결과가 없습니다(진료과 선택 시 정확도 상승).</p>
                )}
              </>
            )}
          </div>

          {/* ③ 홈페이지 검색·AI 노출 정밀진단 */}
          <div className={CARD}>
            <h3 className="text-sm font-bold text-ink">③ 홈페이지 검색·AI 노출 <span className="font-normal text-slate-400">정밀진단 (SEO·GEO)</span></h3>
            {!seo?.attempted ? (
              <p className="mt-2 text-[12.5px] text-slate-400">홈페이지 URL을 입력하면 SEO 100점 + 개선 처방을 실측합니다. 없으면 플레이스·블로그 중심 전략으로 대체.</p>
            ) : !seo.ok ? (
              <p className="mt-2 text-[12.5px] text-amber-600">진단 실패({seo.error}) — URL·접근성을 확인하세요.</p>
            ) : (
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-3xl font-black tabular-nums ${scoreTone(seo.score ?? 0)}`}>{seo.score}</span>
                    <span className="text-xs text-slate-400">/100 · {seo.grade}</span>
                  </div>
                  <span className="text-[12px] text-slate-500">{seo.domain} · 엔진 {seo.version}</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {seo.categories.map((c) => (
                    <div key={c.label} className="rounded-lg border border-line bg-surface/50 p-2.5">
                      <div className="flex items-baseline justify-between text-[11.5px]">
                        <span className="font-semibold text-ink">{c.label}</span>
                        <span className="tabular-nums text-slate-500">{c.score}/{c.max}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
                        <div className={`h-full rounded-full ${c.pct >= 75 ? "bg-emerald-500" : c.pct >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.max(3, c.pct)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                {seo.topFixes.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[12px] font-semibold text-slate-500">개선 우선순위</p>
                    <ul className="mt-1 space-y-1">
                      {seo.topFixes.map((f, i) => (
                        <li key={i} className="text-[11.5px] text-slate-600 dark:text-slate-300"><b className="text-ink">{f.name}</b> — {f.desc}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ④ 경쟁사 */}
          <div className={CARD}>
            <h3 className="text-sm font-bold text-ink">④ 경쟁사 상위 표본 <span className="font-normal text-slate-400">네이버 지역검색</span></h3>
            {!res.competitors.configured ? (
              <p className="mt-2 text-[12.5px] text-slate-400">네이버 지역검색 미연동(NAVER_CLIENT 키).</p>
            ) : res.competitors.places.length ? (
              <ul className="mt-2 divide-y divide-line/60">
                {res.competitors.places.map((p, i) => (
                  <li key={i} className="flex items-baseline gap-2 py-2 text-[12.5px]">
                    <span className="w-4 text-right tabular-nums text-slate-400">{i + 1}</span>
                    <span className="font-semibold text-ink">{p.name}</span>
                    <span className="text-slate-400">{p.category}</span>
                    <span className="ml-auto truncate text-[11px] text-slate-400">{p.roadAddress || p.address}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12.5px] text-slate-400">표본이 없습니다.</p>
            )}
            <p className="mt-2 text-[10.5px] text-slate-400">지역검색 상위 표본(최대 5). 정밀 순위·리뷰수는 플레이스 별도 확인.</p>
          </div>
        </>
      )}
    </div>
  );
}
