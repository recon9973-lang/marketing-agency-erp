// 목표 경로: src/app/(erp)/reports/geo-weekly/page.tsx
//
// GEO 주간 리포트 — 거래처 선택 → 이번 주(월~일) 창으로 M3 assembleGeoWeekly를 온디맨드 조립·렌더.
// 파생·비영속(Report 행 생성 안 함) — 스키마 변경 0. SOV는 M1 computeGeoSov 결과를 선택 주입.
// GEO 모듈 emerald 액센트, 신규 디자인 토큰 없음. geo/page.tsx의 거래처 탭·고지 패턴 미러.
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { GeoWeeklyReport } from "@/components/reports/GeoWeeklyReport";
import { GEO_DISCLAIMER } from "@/domain/sales/geo";
import { assembleGeoWeekly } from "@/server/marketing/geo-weekly";
import { currentWeekWindow } from "@/server/marketing/week-window";
import { computeGeoSov, listGeoMatrix } from "@/server/repositories/geo";
import { listClientsForUser } from "@/server/repositories/clients";
import { getCurrentUser } from "@/server/session";

export default async function GeoWeeklyReportPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { client: clientParam } = await searchParams;
  const clients = await listClientsForUser(user);
  const selectedId = clientParam && clients.some((c) => c.id === clientParam) ? clientParam : clients[0]?.id ?? null;

  // 이번 주 창(월요일 00:00 ~ 다음 월요일 00:00, 반열림) — time.ts weekStart와 동일 규칙.
  const { start, end, weekLabel } = currentWeekWindow();

  const report = selectedId
    ? await (async () => {
        const rows = await listGeoMatrix(selectedId);
        const sov = computeGeoSov(rows);
        return assembleGeoWeekly(selectedId, start, end, { sovPct: sov.sovPct, weekLabel });
      })()
    : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <DashboardHeader
          eyebrow="보고서 · GEO"
          title="GEO 주간 리포트"
          description="거래처별 이번 주 AI 답변 출현·SOV·업무 진행을 규칙기반으로 요약합니다(파생·비영속)."
        />
        <Link
          href="/reports"
          className="self-start rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
        >
          ← 보고서 목록
        </Link>
      </div>

      {/* 미보장 고지 — 상시 표기 */}
      <p className="rounded-xl border border-line bg-surface/60 px-3 py-2 text-[11px] text-slate-500">{GEO_DISCLAIMER}</p>

      {clients.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-slate-500">
          조회 가능한 거래처가 없습니다.
        </p>
      ) : (
        <>
          {/* 거래처 선택 탭 */}
          <div className="flex flex-wrap gap-1.5">
            {clients.map((c) => (
              <Link
                key={c.id}
                href={`/reports/geo-weekly?client=${c.id}`}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  c.id === selectedId
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-line bg-card text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>

          {report ? (
            <GeoWeeklyReport report={report} />
          ) : (
            <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-slate-500">
              거래처를 선택하세요.
            </p>
          )}
        </>
      )}
    </section>
  );
}
