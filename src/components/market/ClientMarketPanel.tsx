// 거래처 인사이트 '주변 상권' 요약(서버 컴포넌트) — 거래처 지역/주소 → 인구·병원 밀집도 실측.
// 전체 분석·리포트는 /market 으로 이어짐. (location-auto ①② 축 요약)
import Link from "next/link";
import { getLocationInsight, nationalHospitalsPerTenThousand } from "@/server/data/region-insight";

function fmt(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("ko-KR");
}

export function ClientMarketPanel({ region }: { region: string }) {
  const q = (region || "").trim();
  if (!q) return null;
  const { resolve, population, hospitals } = getLocationInsight(q);

  if (!resolve.key) {
    return (
      <section className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">주변 상권 <span className="font-normal text-slate-400">실측</span></h3>
          <Link href={`/market?region=${encodeURIComponent(q)}`} className="text-xs font-semibold text-emerald-600 hover:underline">
            상권분석 열기 →
          </Link>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          &lsquo;{q}&rsquo; 지역을 자동 매칭하지 못했습니다. 상권분석에서 시/도를 붙여 조회하세요.
        </p>
      </section>
    );
  }

  const nationalPer = nationalHospitalsPerTenThousand();
  const dense = hospitals?.perTenThousand != null && nationalPer ? hospitals.perTenThousand / nationalPer : null;

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">
          주변 상권 · {resolve.label} <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300">실측</span>
        </h3>
        <Link
          href={`/market?region=${encodeURIComponent(resolve.label)}`}
          className="text-xs font-semibold text-emerald-600 hover:underline"
        >
          상권분석 · 리포트 →
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface/50 p-2 text-center">
          <div className="text-lg font-bold text-ink">{fmt(population?.total)}</div>
          <div className="text-[10px] text-slate-500">인구</div>
        </div>
        <div className="rounded-xl border border-line bg-surface/50 p-2 text-center">
          <div className="text-lg font-bold text-ink">{population?.femaleRatio ?? "—"}%</div>
          <div className="text-[10px] text-slate-500">여성 비중</div>
        </div>
        <div className="rounded-xl border border-line bg-surface/50 p-2 text-center">
          <div className="text-lg font-bold text-ink">{fmt(hospitals?.total)}</div>
          <div className="text-[10px] text-slate-500">병·의원</div>
        </div>
        <div className="rounded-xl border border-line bg-surface/50 p-2 text-center">
          <div className="text-lg font-bold text-ink">{hospitals?.perTenThousand ?? "—"}</div>
          <div className="text-[10px] text-slate-500">만명당(전국 {nationalPer})</div>
        </div>
      </div>
      {dense != null && (
        <p className="mt-2 text-[11px] text-slate-500">
          경쟁 강도: {dense >= 1.2 ? "전국 평균 대비 과밀 — 차별화·검색 상위 선점 관건" : dense <= 0.8 ? "전국 평균 대비 여유 — 공급 대비 수요 우위 가능" : "전국 평균 수준"}
        </p>
      )}
    </section>
  );
}
