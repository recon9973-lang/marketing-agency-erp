// GEO Studio 파이프라인 — M1~M5를 한 번에 실행하는 통합 화면.
// 브랜드·카테고리·키워드 입력 → 스캔→CEP→콘텐츠→여정→캠페인이 실제로 연결되어 흐른다.
// 서버 컴포넌트: GET 폼 → searchParams로 runPipeline 실행·렌더(클라이언트 액션 없음).
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { getCurrentUser } from "@/server/session";
import { runPipelineLive, type PipelineResult } from "@/server/geo-studio/pipeline";

const csv = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const won = (n: number) => `₩${Math.round(n).toLocaleString("ko-KR")}`;

type Stage = { id: string; label: string; sub: string; href: string };
const STAGES: Stage[] = [
  { id: "M1", label: "스캔", sub: "AI 인용 측정", href: "/geo-scan" },
  { id: "M2", label: "CEP 발굴", sub: "진입점 탐색", href: "/geo-cep" },
  { id: "M3", label: "콘텐츠", sub: "GEO 게이트", href: "/geo-content" },
  { id: "M4", label: "여정", sub: "키워드 여정맵", href: "/journeymap" },
  { id: "M5", label: "캠페인", sub: "실행 계획", href: "/geo-planner" }
];

export default async function GeoStudioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const brand = one(sp.brand) ?? "";
  const category = one(sp.category) ?? "";
  const keywordsStr = one(sp.keywords) ?? "";
  const competitorsStr = one(sp.competitors) ?? "";
  const budgetStr = one(sp.budget) ?? "";
  const keywords = csv(keywordsStr);
  const ran = Boolean(brand && category && keywords.length);
  const reportQs = new URLSearchParams({ brand, category, keywords: keywordsStr, competitors: competitorsStr, budget: budgetStr }).toString();

  let r: PipelineResult | null = null;
  if (ran) {
    // 실측 우선 — 연결된 키가 있으면 M1(스캔)·M2(CEP)를 실측 실행.
    r = await runPipelineLive({
      brand,
      category,
      keywords,
      competitors: csv(competitorsStr),
      budget: Number(budgetStr) || undefined
    });
  }
  const m1Live = r?.dataTier?.m1 === "measured";
  const m2Live = r?.dataTier?.m2 === "measured";
  const anyLive = m1Live || m2Live;

  const input = "mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none";
  const m5 = r?.stages.m5 as
    | { task_count: number; expected_citation_boost_pp: number; estimated_roi_pct: number; estimated_revenue: number; period: string }
    | undefined;

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="GEO Studio · 통합 파이프라인"
        title="GEO Studio"
        description="AI 검색 최적화 5단계(스캔→CEP 발굴→콘텐츠→여정→캠페인)를 한 번에 실행합니다. 각 단계의 실제 산출물이 다음 단계 입력으로 연결되어, 브랜드 진단부터 실행 캠페인 계획까지 이어집니다."
      />

      {/* 데이터 연결 상태 — M1(스캔)·M2(CEP)는 연결 시 실측, M3~M5는 규칙 계산 */}
      {anyLive ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
          <ConnectionBadge state="connected" hint="일부 단계 실측" />
          <span>
            M1 인용 스캔 <b>{m1Live ? "실측" : "데모"}</b> · M2 CEP <b>{m2Live ? "실측" : "데모"}</b> · M3~M5는 규칙 계산.
            미연결 단계는 <a href="/integrations" className="font-semibold underline">키 연결</a> 시 실측 전환됩니다.
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
          <ConnectionBadge state="demo" hint="M1~M5 시뮬 파이프라인" />
          <span>5단계 산출물은 <b>데모(시뮬레이션)</b>입니다. 실제 AI 인용 측정은 <a href="/geo" className="font-semibold underline">GEO 모니터링</a>, 실측 전환은 <a href="/integrations" className="font-semibold underline">키 연결</a> 후 가능합니다.</span>
        </div>
      )}

      {/* 파이프라인 흐름 */}
      <div className="flex flex-wrap items-stretch gap-2 rounded-2xl border border-line bg-card p-4">
        {STAGES.map((s, i) => (
          <div key={s.id} className="flex items-stretch gap-2">
            <a href={s.href} className="group flex min-w-[104px] flex-col rounded-xl border border-line bg-surface px-3 py-2 transition hover:border-emerald-400">
              <span className="text-[10px] font-bold text-emerald-600">{s.id}</span>
              <span className="text-sm font-semibold text-ink group-hover:text-emerald-700">{s.label}</span>
              <span className="text-[10px] text-slate-400">{s.sub}</span>
            </a>
            {i < STAGES.length - 1 && <span className="flex items-center text-slate-300">→</span>}
          </div>
        ))}
      </div>

      {/* 입력 폼(GET) */}
      <form method="get" className="rounded-2xl border border-line bg-card p-4">
        <p className="mb-3 text-sm font-bold text-ink">파이프라인 입력</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-xs font-medium text-slate-600">브랜드
            <input name="brand" defaultValue={brand || "베놈한의원"} className={input} />
          </label>
          <label className="block text-xs font-medium text-slate-600">카테고리
            <input name="category" defaultValue={category || "강남 한의원"} className={input} />
          </label>
          <label className="block text-xs font-medium text-slate-600">키워드 (쉼표)
            <input name="keywords" defaultValue={keywordsStr || "강남 한의원, 다이어트 한약"} className={input} />
          </label>
          <label className="block text-xs font-medium text-slate-600">경쟁사 (쉼표)
            <input name="competitors" defaultValue={competitorsStr || "서울메디컬"} className={input} />
          </label>
          <label className="block text-xs font-medium text-slate-600">예산 (원)
            <input name="budget" type="number" defaultValue={budgetStr || "5000000"} className={input} />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            ⚡ 파이프라인 실행
          </button>
          <span className="text-[11px] text-slate-400">M1→M2→M3→M4→M5 순차 실행 (현재 목 파이프라인 · 결정적)</span>
        </div>
      </form>

      {r && m5 && (
        <div className="space-y-4">
          {/* 종합 지표(CurrentState) */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "AI 인용율 (M1)", value: `${r.stages.m1.citationRate}%`, sub: `${r.stages.m1.totalQueries}개 질의` },
              { label: "CEP 커버리지 (M2)", value: `${r.stages.m2.cepCoverage}%`, sub: `${r.stages.m2.coveredCeps}/${r.stages.m2.totalCeps} CEP` },
              { label: "GEO 점수 (M3)", value: r.stages.m3.geoScore, sub: r.stages.m3.passed ? "발행 게이트 통과" : "보완 필요" },
              { label: "Topical Authority (M4)", value: `${r.stages.m4.taScore} · ${r.stages.m4.taGrade}`, sub: `노드 ${r.stages.m4.totalNodes}` }
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-line bg-card p-4">
                <p className="text-[11px] text-slate-500">{c.label}</p>
                <p className="text-xl font-bold text-ink">{c.value}</p>
                <p className="text-[10px] text-slate-400">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* 단계별 상세 */}
          <div className="grid gap-3 lg:grid-cols-2">
            {/* M1~M4 요약 */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-line bg-card p-4">
                <p className="mb-2 text-sm font-bold text-ink">M1 · 스캔 → 키워드별 인용율</p>
                <div className="space-y-2">
                  {Object.entries(r.stages.m1.byKeyword).map(([kw, pct]) => (
                    <div key={kw}>
                      <div className="flex justify-between text-xs text-slate-600"><span>{kw}</span><span>{pct}%</span></div>
                      <div className="mt-1 h-2 rounded-full bg-surface"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-card p-4">
                <p className="mb-2 text-sm font-bold text-ink">M2 · 최우선 CEP → M3 콘텐츠 게이트</p>
                <p className="text-xs text-slate-600">최우선 진입점(CEP): <span className="font-medium text-ink">{r.stages.m2.topCep ?? "—"}</span></p>
                <p className="mt-1 text-xs text-slate-600">대상 키워드: <span className="font-medium text-ink">{r.stages.m3.keyword}</span></p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {[
                    { k: "BLUF", v: r.stages.m3.blufScore },
                    { k: "FAQ", v: r.stages.m3.faqScore },
                    { k: "E-E-A-T", v: r.stages.m3.eeatScore },
                    { k: "인용성", v: r.stages.m3.citationScore }
                  ].map((s) => (
                    <div key={s.k} className="rounded-lg bg-surface px-2 py-1.5 text-center">
                      <p className="text-[9px] text-slate-400">{s.k}</p>
                      <p className="text-sm font-semibold text-ink">{s.v}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px]">
                  {r.stages.m3.passed ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">GEO {r.stages.m3.geoScore}점 — 발행 게이트 통과</span>
                  ) : (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700">GEO {r.stages.m3.geoScore}점 — 70점 미만, 보완 후 발행</span>
                  )}
                </p>
              </div>
            </div>

            {/* M5 캠페인 */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
              <p className="mb-3 text-sm font-bold text-emerald-800">M5 · 실행 캠페인 계획 (M1~M4 지표 수급)</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "실행 태스크", value: `${m5.task_count}건` },
                  { label: "예상 인용율 상승", value: `+${m5.expected_citation_boost_pp}%p` },
                  { label: "예상 ROI", value: `${m5.estimated_roi_pct}%` },
                  { label: "예상 매출", value: won(m5.estimated_revenue) }
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-emerald-200 bg-card p-3">
                    <p className="text-[11px] text-slate-500">{c.label}</p>
                    <p className="text-lg font-bold text-emerald-800">{c.value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-slate-500">기간: {m5.period} · 목표 AI 인용율 {r.goal.targetValue}% · 예산 {won(r.goal.budget)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`/geo-studio/report?${reportQs}`} className="inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                  ⬇ 진단 리포트 내보내기 (.md)
                </a>
                <a href={`/geo-planner`} className="inline-block rounded-lg border border-emerald-300 bg-card px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                  캠페인 상세 · 태스크/캘린더 →
                </a>
              </div>
            </div>
          </div>

          {r.stages.m3.briefMd && (
            <details className="rounded-2xl border border-line bg-card p-4">
              <summary className="cursor-pointer text-sm font-bold text-ink">최우선 CEP → 콘텐츠 브리프 (M3 산출물)</summary>
              <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 text-[12px] leading-relaxed text-slate-700">
                {r.stages.m3.briefMd}
              </pre>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
