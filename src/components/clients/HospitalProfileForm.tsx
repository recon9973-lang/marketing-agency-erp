// 목표 경로: src/components/clients/HospitalProfileForm.tsx
//
// 병원 프로파일(Source of Truth) 편집. businessType=HOSPITAL 거래처 상세의 "병원정보" 탭.
// prohibitedClaims(금지 표현)는 이후 의료법 검수 규칙엔진에 주입된다.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { upsertHospitalProfile } from "@/server/actions/hospital-profile";

type Profile = {
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

const FIELDS: { key: string; label: string; hint?: string; rows?: number }[] = [
  { key: "departments", label: "진료과목", hint: "예: 피부과, 성형외과 (쉼표 구분)" },
  { key: "doctors", label: "대표원장·의료진", rows: 2 },
  { key: "strengths", label: "병원 강점", rows: 2 },
  { key: "preferredTone", label: "선호 톤앤매너", hint: "예: 신뢰감, 따뜻함, 전문성" },
  { key: "competitorHospitals", label: "경쟁 병원", hint: "쉼표/줄바꿈 구분" },
  { key: "cautionTerms", label: "주의 표현", rows: 2 }
];

export function HospitalProfileForm({
  clientId,
  profile,
  canEdit
}: {
  clientId: string;
  profile: Profile;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const val = (k: string) => (profile ? ((profile as Record<string, unknown>)[k] as string | null) ?? "" : "");

  function onSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    const payload: Record<string, unknown> = { clientId };
    for (const f of FIELDS) payload[f.key] = String(formData.get(f.key) || "");
    payload.prohibitedClaims = String(formData.get("prohibitedClaims") || "");
    payload.medicalLawNotes = String(formData.get("medicalLawNotes") || "");
    start(async () => {
      const res = await upsertHospitalProfile(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const inputCls = "mt-1 w-full rounded border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";
  const disabled = !canEdit || pending;

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">거래처별 단일 기준 데이터. 모든 AI 생성물·의료법 검수가 이 값을 참조합니다.</p>
        {profile ? <span className="text-xs text-slate-400">기준 버전 v{profile.sotVersion}</span> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className={f.rows ? "block sm:col-span-2" : "block"}>
            <span className="text-sm text-slate-600">{f.label}</span>
            {f.rows ? (
              <textarea name={f.key} defaultValue={val(f.key)} rows={f.rows} disabled={disabled} className={inputCls} />
            ) : (
              <input name={f.key} defaultValue={val(f.key)} disabled={disabled} className={inputCls} />
            )}
            {f.hint ? <span className="mt-0.5 block text-xs text-slate-400">{f.hint}</span> : null}
          </label>
        ))}
      </div>

      {/* 의료법 관련 — 강조 박스 */}
      <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-800">
          <ShieldAlert className="h-4 w-4" /> 의료법 검수 기준
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">금지 표현</span>
          <textarea
            name="prohibitedClaims"
            defaultValue={val("prohibitedClaims")}
            rows={2}
            disabled={disabled}
            placeholder="예: 완치, 최고, 부작용 없음 (콘텐츠 검수 시 자동 탐지에 사용)"
            className={inputCls}
          />
        </label>
        <label className="mt-2 block">
          <span className="text-xs font-semibold text-slate-600">의료법 주의사항 메모</span>
          <textarea name="medicalLawNotes" defaultValue={val("medicalLawNotes")} rows={2} disabled={disabled} className={inputCls} />
        </label>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {canEdit ? (
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {pending ? "저장 중…" : "저장"}
          </button>
          {saved ? <span className="text-sm text-emerald-600">저장됨 (v{(profile?.sotVersion ?? 0) + (profile ? 1 : 1)})</span> : null}
        </div>
      ) : (
        <p className="text-xs text-slate-400">읽기 전용 — 편집 권한이 없습니다.</p>
      )}
    </form>
  );
}
