// GEO 여정 분석 — GEO Studio M4(geo_path_analyzer) 화면.
// 시드 질문 → AI 답변 여정 트리 탐색 → 브랜드 미언급 갭 경로·Top 경로(현재 목 파이프라인).
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { getCurrentUser } from "@/server/session";
import { analyzeJourney, analyzeJourneyLive, type JourneyReport } from "@/server/geo-studio/path/analyzer";
import { JourneyGraph, type RawNode } from "@/components/geo-path/JourneyGraph";

const csv = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function GeoPathPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const brand = one(sp.brand) ?? "";
  const seed = one(sp.seed) ?? "";
  const competitorsStr = one(sp.competitors) ?? "";
  const ran = Boolean(brand && seed);
  // 실측 근사 우선 — 검색광고 연관키워드로 확장 트리. 미연결이면 목 폴백.
  let report: JourneyReport | null = null;
  let journeyLive = false;
  if (ran) {
    const live = await analyzeJourneyLive(brand, seed);
    if (live) {
      report = live;
      journeyLive = true;
    } else {
      report = analyzeJourney(brand, seed, { competitors: csv(competitorsStr) });
    }
  }

  const input = "mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none";

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="GEO Studio · M4"
        title="GEO 여정 분석 (Path Analyzer)"
        description="소비자가 4대 AI 답변 속에서 어떤 질문을 거쳐 브랜드에 도달하는지 여정 트리로 분석하고, 브랜드 미언급 갭 경로를 상류·허브 우선순위로 도출합니다."
      />

      {/* 데이터 연결 상태 — 여정 트리는 시뮬레이션 알고리즘(4-AI 실측 미연결) */}
      {journeyLive ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
          <ConnectionBadge state="connected" hint="연관키워드 실측" />
          <span>여정 트리는 <b>네이버 연관키워드 확장(실측 근사)</b>입니다 — 실제 검색 확장 경로. 단, AI 답변 클릭스트림이 아니며 노드 언급은 키워드에 브랜드명 포함 여부로 판정합니다.</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
          <div className="flex flex-wrap items-center gap-2">
            <ConnectionBadge state="demo" hint="여정 실측 미연결" />
            <span>여정 트리·갭 경로는 <b>데모(시뮬레이션)</b>입니다. 실제 AI 인용 측정은 <a href="/geo" className="font-semibold underline">GEO 모니터링</a>에서 확인하세요.</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-amber-200 pt-2 text-xs">
            <span className="text-amber-700">실측 연결:</span>
            <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] text-amber-900">NAVER_AD_API_KEY</code>
            <span className="text-amber-600">→ 연관키워드 확장 여정(실측 근사)</span>
            <a href="/integrations" className="ml-1 font-semibold text-amber-900 underline">연결 상태 →</a>
          </div>
        </div>
      )}

      <form method="get" className="rounded-2xl border border-line bg-card p-4">
        <p className="mb-3 text-sm font-bold text-ink">여정 탐색 입력</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block text-xs font-medium text-slate-600">브랜드
            <input name="brand" defaultValue={brand || "햇살숙소"} className={input} />
          </label>
          <label className="block text-xs font-medium text-slate-600">시드 질문
            <input name="seed" defaultValue={seed || "제주 숙소 추천"} className={input} />
          </label>
          <label className="block text-xs font-medium text-slate-600">경쟁사 (쉼표)
            <input name="competitors" defaultValue={competitorsStr || "블루하우스, 코지스테이"} className={input} />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">🧭 여정 분석</button>
          <span className="text-[11px] text-slate-400">4대 AI 재귀 여정 탐색 → 갭 경로 우선순위 (현재 목 파이프라인)</span>
        </div>
      </form>

      {report && (
        <div className="space-y-4">
          {journeyLive ? (
            <p className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-100/70 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 연관키워드 실측 근사 · 언급률=키워드에 브랜드명 포함 비율
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-100/70 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> 아래 수치는 데모(시뮬레이션) — 실측 아님
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "여정 노드", value: report.total_nodes },
              { label: "브랜드 언급률", value: `${report.brand_mention_rate}%` },
              { label: "갭 경로", value: report.gap_count }
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-line bg-card p-4">
                <p className="text-[11px] text-slate-500">{c.label}</p>
                <p className="text-xl font-bold text-ink">{c.value}</p>
              </div>
            ))}
          </div>

          {/* 검색 경로 그래프(SVG) */}
          <JourneyGraph tree={report.tree as unknown as RawNode} primaryPath={report.top_paths[0] ?? []} brand={brand} />

          {/* 갭 경로 */}
          <div className="overflow-x-auto rounded-2xl border border-line bg-card">
            <p className="px-4 pt-4 text-sm font-bold text-ink">브랜드 미언급 갭 경로 (우선순위순)</p>
            <p className="px-4 text-[11px] text-slate-400">상류(얕은 깊이)·허브(분기 많음)일수록 우선 — 콘텐츠 보강 대상</p>
            <table className="mt-2 w-full min-w-[560px] border-collapse text-left text-sm">
              <thead className="border-y border-line bg-surface text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-2">질문 노드</th>
                  <th className="px-2 py-2">깊이</th>
                  <th className="px-2 py-2">우선순위</th>
                </tr>
              </thead>
              <tbody>
                {report.top_gaps.map((gp, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-4 py-2 font-medium text-ink">{gp.query}</td>
                    <td className="px-2 py-2 text-slate-500">D{gp.depth}</td>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-16 overflow-hidden rounded-full bg-surface">
                          <span className="block h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, gp.priority)}%` }} />
                        </span>
                        <span className="font-semibold text-emerald-700">{gp.priority}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top 여정 경로 */}
          <div className="rounded-2xl border border-line bg-card p-4">
            <p className="mb-2 text-sm font-bold text-ink">주요 여정 경로 (루트 → 리프)</p>
            <ul className="space-y-1.5">
              {report.top_paths.map((p, i) => (
                <li key={i} className="text-xs text-slate-600">
                  {p.map((q, j) => (
                    <span key={j}>
                      {j > 0 && <span className="text-slate-400"> → </span>}
                      <span className={j === p.length - 1 ? "font-medium text-ink" : ""}>{q}</span>
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
