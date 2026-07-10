// 목표 경로: src/components/clients/ClientDetail.tsx
//
// 거래처 상세 — 탭(기본정보/채널계정/업무/입금/보고서). 각 탭에 조회 + 입력 폼 조립.
// 재무(입금) 탭은 마케터에게 숨김. 입력 폼은 관리자 이상(canManage)에게만.
"use client";

import { useState } from "react";
import { CredentialField } from "@/components/clients/CredentialField";
import { ClientForm } from "@/components/clients/ClientForm";
import { HospitalProfileForm } from "@/components/clients/HospitalProfileForm";
import { ConsultingPanel } from "@/components/clients/ConsultingPanel";
import { ContentPlanPanel } from "@/components/clients/ContentPlanPanel";
import { ClientPortalLink } from "@/components/clients/ClientPortalLink";
import { AddChannelForm } from "@/components/clients/AddChannelForm";
import { WorkStatusButtons } from "@/components/work/WorkStatusButtons";
import { AddWorkForm } from "@/components/work/AddWorkForm";
import { ReportEditor } from "@/components/reports/ReportEditor";

type WorkStatus = "NOT_STARTED" | "IN_PROGRESS" | "WAITING" | "REVIEW_NEEDED" | "COMPLETED" | "BLOCKED";
type Channel = { id: string; label: string; channelName: string; externalUrl: string | null; hasCredentials: boolean };
type WorkRow = { id: string; title: string; status: string; dueDate: string | null };
type Billing = { id: string; billingMonth: string; issuedAmount: number; paidAmount: number; status: string };
type ReportRow = { id: string; title: string; reportingMonth: string; status: string; metrics: Record<string, unknown> | null };
type IndustryNode = { id: string; name: string; parentId: string | null; colorTag: string | null };
type Marketer = { id: string; name: string };

export function ClientDetail({
  client,
  channels,
  works,
  billings,
  reports,
  hospitalProfile,
  consulting,
  contentPlans,
  canViewFinance,
  canManage,
  industries,
  marketers
}: {
  client: {
    id: string;
    name: string;
    code: string;
    businessType: "HOSPITAL" | "OTHER";
    portalToken: string | null;
    industryName: string | null;
    assignedMarketerName: string | null;
    active: boolean;
    assignedMarketerId: string | null;
    industryCategoryId: string | null;
    industryCustom: string | null;
  };
  channels: Channel[];
  works: WorkRow[];
  billings: Billing[];
  reports: ReportRow[];
  hospitalProfile: {
    departments: string | null;
    doctors: string | null;
    strengths: string | null;
    cautionTerms: string | null;
    preferredTone: string | null;
    prohibitedClaims: string | null;
    competitorHospitals: string | null;
    medicalLawNotes: string | null;
    sotVersion: number;
    updatedAt: string;
  } | null;
  consulting: {
    aiConfigured: boolean;
    defaults: { hospitalName: string; address: string; departments: string };
    report: {
      id: string;
      hospitalName: string;
      keywords: { keyword: string; intent: string; priority: number; channel: string }[];
      competitors: string | null;
      marketAnalysis: string | null;
      summary: string | null;
      createdAt: string;
    } | null;
    quotes: { id: string; tier: string; items: { productId: string | null; name: string; monthlyFee: number; quantity: number }[]; monthlyTotal: number; status: string; createdAt: string }[];
  };
  contentPlans: {
    id: string;
    month: string;
    topic: string;
    keyword: string | null;
    angle: string | null;
    faq: string[];
    qa: { q: string; a: string }[];
    complianceRisk: { high: number; medium: number; flags: { label: string; matched: string; code: number; severity: string }[] } | null;
    status: string;
    createdAt: string;
  }[];
  canViewFinance: boolean;
  canManage: boolean;
  industries: IndustryNode[];
  marketers: Marketer[];
}) {
  const isHospital = client.businessType === "HOSPITAL";
  const tabs = [
    "기본정보",
    ...(isHospital ? ["병원정보"] : []),
    "컨설팅",
    "콘텐츠",
    "채널계정",
    "업무",
    ...(canViewFinance ? ["입금"] : []),
    "보고서"
  ];
  const [tab, setTab] = useState(tabs[0]);
  const [editing, setEditing] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-bold text-ink">{client.name}</h1>
        <span className="text-sm text-slate-400">{client.code}</span>
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${isHospital ? "bg-brand-soft text-brand-strong" : "bg-slate-100 text-slate-600"}`}>
          {isHospital ? "🏥 병원" : "기타"}
        </span>
        {client.industryName && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{client.industryName}</span>}
        {!client.active && <span className="text-xs text-slate-400">비활성</span>}
      </div>

      <nav className="mb-4 flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm ${tab === t ? "border-b-2 border-brand font-semibold text-brand-strong" : "text-slate-500 hover:text-ink"}`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "기본정보" && (
        <div>
          {editing ? (
            <div className="rounded-xl border border-line bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink">거래처 정보 수정</h3>
                <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:underline">닫기</button>
              </div>
              <ClientForm
                industries={industries}
                marketers={marketers}
                initial={{
                  id: client.id,
                  name: client.name,
                  code: client.code,
                  businessType: client.businessType,
                  industryCategoryId: client.industryCategoryId,
                  industryCustom: client.industryCustom,
                  assignedMarketerId: client.assignedMarketerId
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-slate-500">담당 마케터</dt><dd className="mt-1 text-ink">{client.assignedMarketerName ?? "미배정"}</dd></div>
                <div><dt className="text-slate-500">업종</dt><dd className="mt-1 text-ink">{client.industryName ?? "-"}</dd></div>
              </dl>
              {canManage && (
                <button onClick={() => setEditing(true)} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface">
                  정보 수정
                </button>
              )}
              {canManage && <ClientPortalLink clientId={client.id} token={client.portalToken} />}
            </div>
          )}
        </div>
      )}

      {tab === "병원정보" && (
        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-ink">병원 프로파일 (기준 데이터)</h3>
          <HospitalProfileForm clientId={client.id} profile={hospitalProfile} canEdit={canManage} />
        </div>
      )}

      {tab === "컨설팅" && (
        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-ink">영업 컨설팅 (키워드·경쟁·상권)</h3>
          <ConsultingPanel
            clientId={client.id}
            aiConfigured={consulting.aiConfigured}
            defaults={consulting.defaults}
            report={consulting.report}
            quotes={consulting.quotes}
            canRun={canManage}
          />
        </div>
      )}

      {tab === "콘텐츠" && (
        <div className="rounded-xl border border-line bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-ink">콘텐츠 기획 (AI 초안 + 의료법 검수)</h3>
          <ContentPlanPanel clientId={client.id} plans={contentPlans} aiConfigured={consulting.aiConfigured} canManage={canManage} />
        </div>
      )}

      {tab === "채널계정" && (
        <div className="space-y-4">
          {canManage && <AddChannelForm clientId={client.id} />}
          <table className="w-full text-sm">
            <tbody>
              {channels.length === 0 && <tr><td className="py-2 text-slate-400">등록된 채널이 없습니다.</td></tr>}
              {channels.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="py-2 font-medium text-ink">{c.channelName}</td>
                  <td className="text-slate-600">{c.label}</td>
                  <td>{c.externalUrl ? <a href={c.externalUrl} className="text-brand-strong underline" target="_blank" rel="noreferrer">링크</a> : "-"}</td>
                  <td><CredentialField accountId={c.id} hasCredentials={c.hasCredentials} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "업무" && (
        <div className="space-y-4">
          {canManage && <AddWorkForm clientId={client.id} marketers={marketers} />}
          <table className="w-full text-sm">
            <tbody>
              {works.length === 0 && (
                <tr><td className="py-2 text-slate-400">등록된 업무가 없습니다.</td></tr>
              )}
              {works.map((w) => (
                <tr key={w.id} className="border-t border-line">
                  <td className="py-2 font-medium text-ink">{w.title}</td>
                  <td className="text-slate-500">{w.dueDate ?? "-"}</td>
                  <td className="py-2 text-right"><WorkStatusButtons workId={w.id} status={w.status as WorkStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "입금" && canViewFinance && (
        <table className="w-full text-sm">
          <tbody>
            {billings.length === 0 && <tr><td className="py-2 text-slate-400">등록된 청구/입금이 없습니다. (/정산·지출에서 등록)</td></tr>}
            {billings.map((b) => (
              <tr key={b.id} className="border-t border-line">
                <td className="py-2">{b.billingMonth}</td>
                <td className="text-right">{b.paidAmount.toLocaleString()} / {b.issuedAmount.toLocaleString()}원</td>
                <td className="text-right">{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "보고서" && (
        <div className="space-y-6">
          {reports.length === 0 && <p className="text-sm text-slate-400">등록된 보고서가 없습니다. 보고서는 /reports 에서도 생성할 수 있습니다.</p>}
          {reports.map((r) => (
            <section key={r.id} className="rounded-xl border border-line p-4">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="font-medium text-ink">{r.title}</h3>
                <span className="text-xs text-slate-400">{r.reportingMonth}</span>
              </div>
              <ReportEditor report={{ id: r.id, status: r.status, metrics: r.metrics }} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
