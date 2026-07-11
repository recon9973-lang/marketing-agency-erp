// 목표 경로: src/app/(erp)/geo/page.tsx
//
// GEO 모니터링 — 거래처 선택 → 질문×엔진 매트릭스 + 후보 생성 + 배치 승인 + 관측 기록.
// "AI 답변 출현은 보장이 아닌 모니터링 지표" 고지를 상시 표기(기획서 §7).
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { GeoMatrix } from "@/components/geo/GeoMatrix";
import { GeoCandidateGenerator, GeoAnswerRecorder } from "@/components/geo/GeoTools";
import { GEO_DISCLAIMER } from "@/domain/sales/geo";
import { listGeoMatrix, summarizeGeoMatrix } from "@/server/repositories/geo";
import { listInsightClients } from "@/server/repositories/insights";
import { getCurrentUser } from "@/server/session";

export default async function GeoPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { client: clientParam } = await searchParams;
  const clients = await listInsightClients(user);
  const selectedId = clientParam && clients.some((c) => c.id === clientParam) ? clientParam : clients[0]?.id ?? null;
  const rows = selectedId ? await listGeoMatrix(selectedId) : [];
  const summary = summarizeGeoMatrix(rows);

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

          {selectedId && (
            <>
              <GeoCandidateGenerator clientId={selectedId} />
              <GeoMatrix clientId={selectedId} rows={rows} />
              <GeoAnswerRecorder questions={rows} />
            </>
          )}
        </>
      )}
    </section>
  );
}
