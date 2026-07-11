// 목표 경로: src/components/leads/LeadEditForm.tsx
//
// 리드 수정(접이식) — 등록 후 오타 정정·담당 AE 재배정·등급·다음 액션 변경.
// 관리자는 삭제 가능(중복 병합 처리 — AddLeadForm 안내와 연결).
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLead, deleteLead } from "@/server/actions/leads";
import type { LeadMarketer } from "@/components/leads/AddLeadForm";
import type { LeadDetail } from "@/server/repositories/leads";

const inputCls =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink placeholder:text-slate-400";

export function LeadEditForm({
  lead,
  marketers,
  canDelete
}: {
  lead: LeadDetail;
  marketers: LeadMarketer[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(form: FormData) {
    setError(null);
    start(async () => {
      const res = await updateLead({
        id: lead.id,
        hospitalName: String(form.get("hospitalName") ?? "") || lead.hospitalName,
        department: String(form.get("department") ?? "") || null,
        region: String(form.get("region") ?? "") || null,
        source: String(form.get("source") ?? "") || null,
        contactName: String(form.get("contactName") ?? "") || null,
        contactPhone: String(form.get("contactPhone") ?? "") || null,
        contactEmail: String(form.get("contactEmail") ?? "") || null,
        websiteUrl: String(form.get("websiteUrl") ?? "") || null,
        placeUrl: String(form.get("placeUrl") ?? "") || null,
        adBudgetEstimate: form.get("adBudgetEstimate") ? Number(form.get("adBudgetEstimate")) : null,
        grade: (String(form.get("grade") ?? "") || null) as "A" | "B" | "C" | null,
        assigneeId: String(form.get("assigneeId") ?? "") || null,
        nextActionAt: String(form.get("nextActionAt") ?? "") || null,
        note: String(form.get("note") ?? "") || null
      });
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!window.confirm(`"${lead.hospitalName}" 리드를 삭제합니다. 중복 병합 등 관리 목적으로만 사용하세요. 진행할까요?`)) return;
    start(async () => {
      const res = await deleteLead({ id: lead.id });
      if (!res.ok) setError(res.error);
      else router.push("/leads");
    });
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm font-bold text-ink" aria-expanded={open}>
          {open ? "− 리드 정보 수정 닫기" : "✎ 리드 정보 수정"}
        </button>
        {canDelete && (
          <button type="button" onClick={remove} disabled={pending} className="text-xs text-slate-400 hover:text-rose-600 disabled:opacity-50">
            삭제(병합)
          </button>
        )}
      </div>
      {open && (
        <form action={submit} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-xs font-medium text-slate-600">
              병원명 *
              <input name="hospitalName" required maxLength={200} defaultValue={lead.hospitalName} className={inputCls} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              진료과
              <input name="department" maxLength={100} defaultValue={lead.department ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              지역
              <input name="region" maxLength={100} defaultValue={lead.region ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              유입 경로
              <input name="source" maxLength={100} defaultValue={lead.source ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              등급
              <select name="grade" defaultValue={lead.grade ?? ""} className={inputCls}>
                <option value="">미지정</option>
                <option value="A">A (높음)</option>
                <option value="B">B</option>
                <option value="C">C (낮음)</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              담당 AE
              <select name="assigneeId" defaultValue={lead.assigneeId ?? ""} className={inputCls}>
                <option value="">미배정</option>
                {marketers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              담당자명
              <input name="contactName" maxLength={100} defaultValue={lead.contactName ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              연락처
              <input name="contactPhone" maxLength={50} defaultValue={lead.contactPhone ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              이메일
              <input name="contactEmail" type="email" maxLength={200} defaultValue={lead.contactEmail ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              홈페이지 URL
              <input name="websiteUrl" maxLength={500} defaultValue={lead.websiteUrl ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              플레이스 URL
              <input name="placeUrl" maxLength={500} defaultValue={lead.placeUrl ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              월 광고비 추정(원)
              <input name="adBudgetEstimate" type="number" min={0} defaultValue={lead.adBudgetEstimate ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              다음 액션 예정일
              <input name="nextActionAt" type="date" defaultValue={lead.nextActionAt ? lead.nextActionAt.slice(0, 10) : ""} className={inputCls} />
            </label>
          </div>
          <label className="block space-y-1 text-xs font-medium text-slate-600">
            메모
            <textarea name="note" rows={2} maxLength={2000} defaultValue={lead.note ?? ""} className={inputCls} />
          </label>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button type="submit" disabled={pending} className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            {pending ? "저장 중…" : "수정 저장"}
          </button>
        </form>
      )}
    </div>
  );
}
