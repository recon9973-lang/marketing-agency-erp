// 목표 경로: src/app/(erp)/leads/[id]/page.tsx
//
// 리드 상세 — 기본정보 / 상태 전이 / 무료진단(§11) / 거래처 전환.
// 별도 /audits 라우트 대신 리드 맥락 안에 진단을 내장(패널 결정 #5).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, toneForStatus } from "@/components/ui/StatusBadge";
import { LeadStatusButtons } from "@/components/leads/LeadStatusButtons";
import { LeadAuditPanel } from "@/components/leads/LeadAuditPanel";
import { LeadEditForm } from "@/components/leads/LeadEditForm";
import { LeadQuotesPanel } from "@/components/leads/LeadQuotesPanel";
import { ConvertLeadButton } from "@/components/leads/ConvertLeadButton";
import { LeadConsultingPanel } from "@/components/leads/LeadConsultingPanel";
import { getLeadConsulting, listLeadAnalyses } from "@/server/repositories/consulting";
import { isAiConfigured } from "@/server/ai/claude";
import { leadStatusLabels } from "@/domain/sales/lead-stages";
import { Role } from "@/domain/types";
import { NON_GUARANTEE_DISCLAIMER } from "@/server/compliance/medical-law";
import { db } from "@/server/db";
import { getLead } from "@/server/repositories/leads";
import { listLeadQuotes } from "@/server/repositories/quotes";
import { getCurrentUser } from "@/server/session";

const dateTimeFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });
const wonFmt = new Intl.NumberFormat("ko-KR");

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2 text-sm last:border-b-0">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right text-slate-700">{value ?? "-"}</span>
    </div>
  );
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const lead = await getLead(user, id);
  if (!lead) notFound();

  const [quotes, marketers, consultingReport, leadAnalyses] = await Promise.all([
    listLeadQuotes(lead.id),
    db.user.findMany({ where: { role: Role.MARKETER, status: "ACTIVE" }, select: { id: true, name: true } }).catch(() => []),
    getLeadConsulting(lead.id).catch(() => null),
    listLeadAnalyses(lead.id).catch(() => [])
  ]);
  const canRunConsulting = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN || lead.assigneeId === user.id;

  const statusLabel = leadStatusLabels[lead.status as keyof typeof leadStatusLabels] ?? lead.status;
  const canConvert = lead.status === "PROPOSAL" && !lead.clientId;
  const canDelete = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
  const showQuotes = ["AUDIT", "MEETING", "PROPOSAL", "WON"].includes(lead.status) || quotes.length > 0;

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="영업 리드"
        title={lead.hospitalName}
        description={[lead.department, lead.region].filter(Boolean).join(" · ") || undefined}
        actions={<StatusBadge tone={toneForStatus(lead.status)}>{statusLabel}</StatusBadge>}
      />

      {/* 계약 전 컨설팅 미팅 준비 — 리드 정보로 상권분석·마케팅 전략 바로 실행(프리필). */}
      <div className="rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-ink">🩺 컨설팅 미팅 준비</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              이 리드 정보(병원명·지역{lead.department ? "·진료과" : ""}{lead.websiteUrl ? "·홈페이지" : ""})로 분석을 바로 시작합니다 — 계약 전 대면 미팅 자료.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={{ pathname: "/market", query: { region: lead.region ?? "", specialty: lead.department ?? "", brand: lead.hospitalName, leadId: lead.id } }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-card px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800/60 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            >
              🗺️ 상권분석
            </Link>
            <Link
              href={{ pathname: "/strategy", query: { region: lead.region ?? "", specialty: lead.department ?? "", brand: lead.hospitalName, url: lead.websiteUrl ?? "", leadId: lead.id } }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              🎯 마케팅 전략
            </Link>
          </div>
        </div>
        {!lead.region && <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">※ 리드에 지역이 없어 분석 화면에서 지역(구·동)을 입력해야 합니다.</p>}

        {leadAnalyses.length > 0 && (
          <div className="mt-3 border-t border-brand/20 pt-3">
            <p className="text-xs font-semibold text-slate-500">🗂️ 이 리드에 저장된 분석 <span className="font-normal text-slate-400">{leadAnalyses.length}건</span></p>
            <ul className="mt-1.5 space-y-1.5">
              {leadAnalyses.map((a) => (
                <li key={a.id}>
                  <details className="rounded-lg border border-line bg-card px-3 py-2">
                    <summary className="flex cursor-pointer items-center gap-2 text-[12.5px]">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${a.track === "market" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-brand-soft text-brand-strong"}`}>{a.track === "market" ? "상권분석" : "마케팅 전략"}</span>
                      <span className="font-semibold text-ink">{a.title}</span>
                      {a.departments && <span className="text-[11px] text-slate-400">{a.departments}</span>}
                      {a.summary && <span className="text-[11px] text-slate-500">{a.summary}</span>}
                      <span className="ml-auto text-[11px] tabular-nums text-slate-400">{a.createdAt.slice(0, 10)}</span>
                    </summary>
                    {a.markdown && <pre className="mt-2 max-h-[360px] overflow-auto rounded-md border border-line bg-surface/50 p-2.5 text-[11px] leading-relaxed text-ink whitespace-pre-wrap">{a.markdown}</pre>}
                  </details>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 기본 정보 */}
        <div className="rounded-xl border border-line bg-panel p-4">
          <h2 className="text-sm font-bold text-ink">기본 정보</h2>
          <div className="mt-2">
            <InfoRow label="담당 AE" value={lead.assigneeName ?? "미배정"} />
            <InfoRow label="등급" value={lead.grade ? `${lead.grade}등급` : "-"} />
            <InfoRow label="유입 경로" value={lead.source} />
            <InfoRow label="담당자" value={lead.contactName} />
            <InfoRow label="연락처" value={lead.contactPhone} />
            <InfoRow label="이메일" value={lead.contactEmail} />
            <InfoRow
              label="홈페이지"
              value={
                lead.websiteUrl ? (
                  <a href={lead.websiteUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    {lead.websiteUrl}
                  </a>
                ) : (
                  "-"
                )
              }
            />
            <InfoRow
              label="플레이스"
              value={
                lead.placeUrl ? (
                  <a href={lead.placeUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    링크
                  </a>
                ) : (
                  "-"
                )
              }
            />
            <InfoRow
              label="월 광고비 추정"
              value={lead.adBudgetEstimate !== null ? `${wonFmt.format(lead.adBudgetEstimate)}원` : "-"}
            />
            <InfoRow
              label="다음 액션"
              value={lead.nextActionAt ? dateTimeFmt.format(new Date(lead.nextActionAt)) : "-"}
            />
            <InfoRow
              label="개인정보 동의"
              value={
                lead.consentAt
                  ? `${dateTimeFmt.format(new Date(lead.consentAt))} (${lead.consentTextVersion})`
                  : "동의 기록 없음"
              }
            />
            {lead.lostReason ? <InfoRow label="실패 사유" value={lead.lostReason} /> : null}
          </div>
          {lead.note && (
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface/60 p-3 text-xs text-slate-600">{lead.note}</p>
          )}
        </div>

        {/* 상태 전이 + 전환 */}
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-panel p-4">
            <h2 className="text-sm font-bold text-ink">상태 관리</h2>
            <p className="mt-1 text-xs text-slate-500">
              현재 <b>{statusLabel}</b> — 허용된 전이만 표시됩니다. (전이 규칙: 기획서 §12)
            </p>
            <div className="mt-3">
              <LeadStatusButtons leadId={lead.id} status={lead.status} />
            </div>
            {canConvert && (
              <div className="mt-4 border-t border-line pt-4">
                <ConvertLeadButton leadId={lead.id} hospitalName={lead.hospitalName} />
                <p className="mt-2 text-[11px] text-slate-400">
                  거래처·병원프로필이 생성되고 계약서/견적으로 이어집니다.
                </p>
              </div>
            )}
            {lead.clientId && (
              <p className="mt-3 text-xs text-emerald-600">
                거래처 전환 완료 —{" "}
                <Link href={`/clients/${lead.clientId}`} className="font-semibold underline">
                  거래처 화면으로 이동
                </Link>
              </p>
            )}
          </div>

          {/* 무료진단 */}
          <LeadAuditPanel
            leadId={lead.id}
            websiteUrl={lead.websiteUrl}
            initialChecklist={lead.auditChecklist}
            initialScore={lead.auditScore}
            initialNote={lead.auditNote}
            initialAuditResult={lead.auditResult}
            initialEngineVersion={lead.auditEngineVersion}
            initialRunAt={lead.auditRunAt}
          />

          {/* 제안 견적 3안 — 진단 이후 단계부터 노출 */}
          {showQuotes && <LeadQuotesPanel leadId={lead.id} quotes={quotes} disclaimer={NON_GUARANTEE_DISCLAIMER} />}
        </div>
      </div>

      {/* 컨설팅 보고서 (계약 전 제안용 · 전환 시 거래처 승계) */}
      <LeadConsultingPanel
        leadId={lead.id}
        aiConfigured={isAiConfigured()}
        canRun={canRunConsulting}
        defaults={{
          hospitalName: lead.hospitalName,
          address: lead.region ?? "",
          departments: lead.department ?? "",
          competitors: ""
        }}
        report={consultingReport}
      />

      {/* 리드 수정·삭제 */}
      <LeadEditForm lead={lead} marketers={marketers} canDelete={canDelete} />
    </section>
  );
}
