// 모니터링 — 워크플로우 마지막 단계(월간리포트 제출 → 모니터링) 전용 화면.
// /geo(진단)에서 분리: AI 인용 관측 실행·언급률 추이·월보장 순위·엔진 레이더·경쟁 랭킹·질문별 추이.
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { GeoAutoWatch } from "@/components/geo/GeoAutoWatch";
import { MentionRateTrend } from "@/components/geo/MentionRateTrend";
import { GuardedRankTrend } from "@/components/geo/GuardedRankTrend";
import { EngineRadar } from "@/components/geo/EngineRadar";
import { MentionStanding } from "@/components/geo/MentionStanding";
import { QuestionMentionTrend } from "@/components/geo/QuestionMentionTrend";
import { GeoMonthlyReport } from "@/components/geo/GeoMonthlyReport";
import { ScorePair } from "@/components/geo/ScorePair";
import { configuredEngines } from "@/server/geo-engine/engines";
import { GEO_DISCLAIMER } from "@/domain/sales/geo";
import { listGeoMatrix, listPublishedPages, summarizeGeoMatrix } from "@/server/repositories/geo";
import {
  getMentionRateSeries,
  getGuardedRankSeries,
  getEngineRadar,
  getMentionStanding,
  getQuestionMentionSeries
} from "@/server/repositories/citation-score";
import { listInsightClients } from "@/server/repositories/insights";
import { getCurrentUser } from "@/server/session";

export default async function GeoMonitorPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { client: clientParam } = await searchParams;
  const clients = await listInsightClients(user);
  const selectedId = clientParam && clients.some((c) => c.id === clientParam) ? clientParam : clients[0]?.id ?? null;
  const selectedName = clients.find((c) => c.id === selectedId)?.name ?? "";

  const [rows, publishedPages, mentionSeries, guardedSeries, engineRadar, standing, questionSeries] = selectedId
    ? await Promise.all([
        listGeoMatrix(selectedId),
        listPublishedPages(selectedId).catch(() => []),
        getMentionRateSeries(selectedId).catch(() => []),
        getGuardedRankSeries(selectedId).catch(() => []),
        getEngineRadar(selectedId).catch(() => ({ engines: [], beforeDate: null, nowDate: null })),
        getMentionStanding(selectedId, selectedName).catch(() => []),
        getQuestionMentionSeries(selectedId).catch(() => ({ dates: [], questions: [] }))
      ])
    : [[], [], [], [], { engines: [], beforeDate: null, nowDate: null }, [], { dates: [], questions: [] }];

  const summary = summarizeGeoMatrix(rows);
  const geoScore = mentionSeries.length ? mentionSeries[mentionSeries.length - 1].rate : 0;
  const guardHeld = guardedSeries.filter((s) => {
    const last = [...s.points].reverse().find((p) => p.rank != null);
    return last && s.targetRank != null && (last.rank as number) <= s.targetRank;
  }).length;
  const seoScore = guardedSeries.length ? Math.round((guardHeld / guardedSeries.length) * 100) : null;
  const reportData = {
    mentionStart: mentionSeries[0]?.rate ?? null,
    mentionNow: mentionSeries.length ? mentionSeries[mentionSeries.length - 1].rate : null,
    citedCount: summary.citedCount,
    monitoredCount: summary.monitoredCount,
    guardHeld,
    guardTotal: guardedSeries.length,
    publishedCount: publishedPages.length
  };

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="워크플로우 마지막 단계"
        title="모니터링"
        description="계약 이후 성과를 지속 관측합니다 — AI 답변 언급률(GEO)·네이버 월보장 순위(SEO) 추이, 엔진별 분포, 경쟁사 랭킹."
      />
      <p className="rounded-xl border border-line bg-surface/60 px-3 py-2 text-[11px] text-slate-500">{GEO_DISCLAIMER}</p>

      {clients.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-slate-500">
          등록된 거래처가 없습니다. 계약 완료 후 거래처가 등록되면 모니터링이 시작됩니다.
        </p>
      ) : (
        <>
          {/* 거래처 선택 */}
          <div className="flex flex-wrap gap-2">
            {clients.map((c) => (
              <a
                key={c.id}
                href={`/geo-monitor?client=${c.id}`}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  c.id === selectedId
                    ? "border-emerald-600 bg-emerald-600 font-semibold text-white"
                    : "border-line bg-card text-slate-600 hover:border-emerald-300"
                }`}
              >
                {c.name}
              </a>
            ))}
          </div>

          <ScorePair
            geoScore={geoScore}
            seoScore={seoScore}
            geoNote={`AI 답변 언급률 ${geoScore}% · ${summary.appearedCount}/${summary.monitoredCount} 질문 출현`}
            seoNote={seoScore === null ? "월보장 키워드 미등록" : `월보장 ${guardHeld}/${guardedSeries.length}건 순위 유지`}
          />

          <GeoAutoWatch
            clientId={selectedId!}
            configuredEngines={configuredEngines().map((e) => e.engine)}
            monitorableCount={rows.filter((r) => r.status === "APPROVED" || r.status === "MONITORING").length}
          />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-card p-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-strong">GEO 트랙</span>
                <h3 className="text-sm font-bold text-ink">전체 언급률 추이</h3>
              </div>
              <p className="mb-3 text-[11px] text-slate-500">AI 답변이 우리 병원을 인용하는 비율 · 주 1회 자동 관측</p>
              <MentionRateTrend points={mentionSeries} />
            </div>
            <div className="rounded-2xl border border-line bg-card p-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">SEO 트랙</span>
                <h3 className="text-sm font-bold text-ink">월보장 순위 추이</h3>
              </div>
              <p className="mb-3 text-[11px] text-slate-500">네이버 검색 순위(계약 약속) · 매일 자동 축적</p>
              {guardedSeries.length > 0 ? (
                <GuardedRankTrend series={guardedSeries[0]} />
              ) : (
                <div className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-8 text-center text-sm text-slate-500">
                  월보장 키워드를 등록하면 순위 추이가 표시됩니다.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-card p-4">
              <h3 className="mb-1 text-sm font-bold text-ink">AI 모델별 언급률</h3>
              <p className="mb-3 text-[11px] text-slate-500">엔진별 분포 · 첫 관측 대비 현재</p>
              <EngineRadar data={engineRadar} />
            </div>
            <div className="rounded-2xl border border-line bg-card p-4">
              <h3 className="mb-1 text-sm font-bold text-ink">언급 현황 (우리 vs 경쟁사)</h3>
              <p className="mb-3 text-[11px] text-slate-500">질문×엔진 최신 관측 기준 랭킹</p>
              <MentionStanding rows={standing} />
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-card p-4">
            <h3 className="mb-1 text-sm font-bold text-ink">질문별 언급률 추이</h3>
            <p className="mb-3 text-[11px] text-slate-500">각 측정질문의 AI 언급률 변화(질문당 한 선)</p>
            <QuestionMentionTrend data={questionSeries} />
          </div>

          <GeoMonthlyReport data={reportData} clientName={selectedName} />
        </>
      )}
    </section>
  );
}
