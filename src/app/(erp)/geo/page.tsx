// 목표 경로: src/app/(erp)/geo/page.tsx
//
// GEO 모니터링 — 거래처 선택 → 질문×엔진 매트릭스 + 후보 생성 + 배치 승인 + 관측 기록.
// "AI 답변 출현은 보장이 아닌 모니터링 지표" 고지를 상시 표기(기획서 §7).
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { GeoMatrix } from "@/components/geo/GeoMatrix";
import { GeoCandidateGenerator, GeoAnswerRecorder, GeoQuestionAdder } from "@/components/geo/GeoTools";
import { GeoAutoWatch } from "@/components/geo/GeoAutoWatch";
import { GeoChannelGuide } from "@/components/geo/GeoChannelGuide";
import { configuredEngines } from "@/server/geo-engine/engines";
import { GEO_DISCLAIMER } from "@/domain/sales/geo";
import { db } from "@/server/db";
import { geoMonthlyTrend, listGeoMatrix, summarizeGeoMatrix } from "@/server/repositories/geo";
import { listInsightClients } from "@/server/repositories/insights";
import { getCurrentUser } from "@/server/session";

export default async function GeoPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { client: clientParam } = await searchParams;
  const clients = await listInsightClients(user);
  const selectedId = clientParam && clients.some((c) => c.id === clientParam) ? clientParam : clients[0]?.id ?? null;
  const [rows, trend, selectedClient] = selectedId
    ? await Promise.all([
        listGeoMatrix(selectedId),
        geoMonthlyTrend(selectedId),
        // 거래처의 진료과·지역을 질문 생성 기본값으로 자동 사용(이중 입력 제거)
        db.client
          .findUnique({
            where: { id: selectedId },
            select: {
              region: true,
              industryCategory: { select: { name: true } },
              hospitalProfile: { select: { departments: true } }
            }
          })
          .catch(() => null)
      ])
    : [[], [], null];
  const summary = summarizeGeoMatrix(rows);

  // 진료과 기본값: 업종(진료과목) 마스터 → 병원프로필 진료과 첫 항목 순으로 채움
  const defaultDepartment =
    selectedClient?.industryCategory?.name ??
    selectedClient?.hospitalProfile?.departments?.split(/[,\n]/)[0]?.trim() ??
    "";
  const defaultRegion = selectedClient?.region ?? "";

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="마케팅"
        title="GEO 모니터링"
        description="생성형 AI(ChatGPT·Perplexity·Gemini 등) 답변에서 병원 언급·인용을 질문 단위로 관측합니다."
      />

      {/* 미보장 고지 — 상시 표기 */}
      <p className="rounded-lg border border-line bg-surface/60 px-3 py-2 text-[11px] text-slate-500">{GEO_DISCLAIMER}</p>

      {clients.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-center text-sm text-slate-500">
          거래처가 없습니다. 먼저 영업 리드를 거래처로 전환해주세요.
        </p>
      ) : (
        <>
          {/* 거래처 선택 탭 */}
          <div className="flex flex-wrap gap-1.5">
            {clients.map((c) => (
              <Link
                key={c.id}
                href={`/geo?client=${c.id}`}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  c.id === selectedId ? "border-blue-300 bg-blue-50 text-blue-700" : "border-line bg-panel text-slate-600"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>

          {/* 요약 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "전체 질문", value: summary.totalQuestions },
              { label: "승인 대기", value: summary.candidateCount },
              { label: "출현 질문", value: summary.appearedCount },
              { label: "인용 질문", value: summary.citedCount }
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-panel px-3 py-2.5">
                <p className="text-[11px] text-slate-500">{s.label}</p>
                <p className="text-lg font-bold text-ink">{s.value}</p>
              </div>
            ))}
          </div>

          {/* 월별 출현 추이 — 관측 질문 대비 출현 질문 비율(모니터링 지표) */}
          {trend.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2.5">
              <span className="text-xs font-bold text-ink">월별 출현 추이</span>
              {trend.map((t) => (
                <span key={t.month} className="rounded-full border border-line bg-white px-2.5 py-0.5 text-[11px] text-slate-600">
                  {Number(t.month.slice(5, 7))}월 <b className="text-ink">{t.rate}%</b>
                  <span className="text-slate-400"> ({t.appeared}/{t.monitored})</span>
                </span>
              ))}
            </div>
          )}

          {selectedId && (
            <>
              <GeoAutoWatch
                clientId={selectedId}
                configuredEngines={configuredEngines().map((e) => e.engine)}
                monitorableCount={rows.filter((r) => r.status === "APPROVED" || r.status === "MONITORING").length}
              />
              <GeoCandidateGenerator clientId={selectedId} defaultDepartment={defaultDepartment} defaultRegion={defaultRegion} />
              <GeoQuestionAdder clientId={selectedId} />
              <GeoMatrix clientId={selectedId} rows={rows} />
              <GeoAnswerRecorder questions={rows} />
              <GeoChannelGuide />
            </>
          )}
        </>
      )}
    </section>
  );
}
