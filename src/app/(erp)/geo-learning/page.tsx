// GEO 학습 모듈 — 실험 장부(개입→인용률)를 학습해 전략 가중치 버전을 관리.
// 제안(공지)→적용→다운그레이드(넘버/기간/부분). 관리자 조작. 서버 컴포넌트.
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCurrentUser } from "@/server/session";
import { Role } from "@/domain/types";
import { getDefaultOrgId } from "@/server/org";
import { listModelVersions } from "@/server/repositories/geo-model";
import { getGlobalKindSummary } from "@/server/repositories/geo-intervention";
import { learnWeights } from "@/domain/geo/learning";
import { GeoLearningPanel, type VersionRow } from "@/components/geo/GeoLearningPanel";

export default async function GeoLearningPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const canManage = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;

  const orgId = await getDefaultOrgId();
  const [rows, preview] = await Promise.all([
    listModelVersions(orgId),
    getGlobalKindSummary(orgId).then((s) => learnWeights(s))
  ]);

  const versions: VersionRow[] = rows.map((v) => ({
    id: v.id,
    version: v.version,
    status: v.status,
    summary: v.summary,
    weights: (v.weights as unknown as VersionRow["weights"]) ?? [],
    diff: (v.diff as unknown as VersionRow["diff"]) ?? [],
    basisCount: v.basisCount,
    appliedAt: v.appliedAt ? v.appliedAt.toISOString() : null,
    createdAt: v.createdAt.toISOString()
  }));

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="GEO Studio · 학습"
        title="GEO 학습 모듈"
        description="쌓인 실험 장부(개입→실측 인용률 변화)를 학습해 '어떤 실행이 인용률을 올리는지' 전략 가중치를 산출합니다. 업그레이드는 번호로 관리되고, 공지로 제안→버튼으로 적용하며, 번호·기간·부분별로 다운그레이드(롤백)할 수 있습니다."
      />

      {/* 현재 학습 미리보기(표본 기준) */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <p className="mb-1 text-sm font-bold text-ink">현재 데이터 학습 결과(미리보기)</p>
        <p className="mb-2 text-[11px] text-slate-500">{preview.summary} · 표본 {preview.basisCount}건</p>
        {preview.weights.filter((w) => w.weight > 0).length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface/40 px-3 py-4 text-center text-[11px] text-slate-400">
            아직 유효한 상승 신호가 부족합니다. 거래처 상세의 <b>실험 장부</b>에 개입을 기록하고 GEO 관측을 쌓으면 학습이 시작됩니다.
          </p>
        ) : (
          <div className="space-y-1">
            {preview.weights.filter((w) => w.weight > 0).map((w) => (
              <div key={w.kind} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-slate-600">{w.label}</span>
                <div className="h-2 flex-1 rounded-full bg-surface">
                  <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, w.weight)}%` }} />
                </div>
                <span className="w-28 shrink-0 text-right tabular-nums text-slate-500">{w.weight}% · +{w.avgLift}%p · n{w.n}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <GeoLearningPanel versions={versions} canManage={canManage} />

      <p className="text-[11px] leading-relaxed text-slate-400">
        학습은 <b>실측 신호(GEO 인용률)</b>에만 근거합니다. 자동 적용은 없으며(사람 승인형), 모든 적용·롤백은 감사 로그로 추적됩니다.
      </p>
    </section>
  );
}
