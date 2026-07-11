// 목표 경로: src/components/leads/AddLeadForm.tsx
//
// 리드 등록 폼(접이식). 연락처 수집 시 개인정보 동의 필수 — 고지문을 본문에 노출하고
// 기본 해제 상태로 제출 직전에 배치(패널 결정 #10, 개인정보보호법 §15).
// 등록 후 중복 후보가 있으면 안내한다(기획서 §5-1 중복검사).
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLead } from "@/server/actions/leads";
import { LEAD_CONSENT_TEXT } from "@/domain/sales/lead-stages";

export function AddLeadForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  function submit(form: FormData) {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await createLead({
        hospitalName: String(form.get("hospitalName") ?? ""),
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
        note: String(form.get("note") ?? "") || null,
        consent
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data && res.data.duplicates.length > 0) {
        setNotice(`중복 후보 ${res.data.duplicates.length}건: ${res.data.duplicates.join(", ")} — 병합 여부를 확인해주세요.`);
      } else {
        setOpen(false);
      }
      setConsent(false);
      router.refresh();
    });
  }

  const inputCls =
    "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink placeholder:text-slate-400";

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-semibold text-ink"
        aria-expanded={open}
      >
        {open ? "− 리드 등록 닫기" : "+ 새 리드 등록"}
      </button>
      {open && (
        <form action={submit} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-xs font-medium text-slate-600">
              병원명 *
              <input name="hospitalName" required maxLength={200} className={inputCls} placeholder="OO정형외과" />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              진료과
              <input name="department" maxLength={100} className={inputCls} placeholder="정형외과" />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              지역
              <input name="region" maxLength={100} className={inputCls} placeholder="서울 강남구" />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              유입 경로
              <input name="source" maxLength={100} className={inputCls} placeholder="폼/소개/리스트" />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              등급
              <select name="grade" className={inputCls} defaultValue="">
                <option value="">미지정</option>
                <option value="A">A (높음)</option>
                <option value="B">B</option>
                <option value="C">C (낮음)</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              월 광고비 추정(원)
              <input name="adBudgetEstimate" type="number" min={0} className={inputCls} placeholder="3000000" />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              담당자명
              <input name="contactName" maxLength={100} className={inputCls} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              연락처
              <input name="contactPhone" maxLength={50} className={inputCls} placeholder="010-0000-0000" />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              이메일
              <input name="contactEmail" type="email" maxLength={200} className={inputCls} />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              홈페이지 URL
              <input name="websiteUrl" maxLength={500} className={inputCls} placeholder="https://" />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              플레이스 URL
              <input name="placeUrl" maxLength={500} className={inputCls} placeholder="https://map.naver.com/..." />
            </label>
          </div>
          <label className="block space-y-1 text-xs font-medium text-slate-600">
            메모
            <textarea name="note" rows={2} maxLength={2000} className={inputCls} />
          </label>

          {/* 개인정보 동의 — 고지문 본문 노출, 기본 해제(§15) */}
          <div className="rounded-lg border border-line bg-surface/60 p-3">
            <p className="text-[11px] leading-relaxed text-slate-500">{LEAD_CONSENT_TEXT}</p>
            <label className="mt-2 flex items-start gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5"
              />
              위 내용을 확인했으며 개인정보 수집·이용에 동의합니다. (연락처 입력 시 필수)
            </label>
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}
          {notice && <p className="text-xs text-amber-600">{notice}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "등록 중…" : "리드 등록"}
          </button>
        </form>
      )}
    </div>
  );
}
