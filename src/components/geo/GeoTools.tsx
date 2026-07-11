// 목표 경로: src/components/geo/GeoTools.tsx
//
// GEO 도구 모음 — 질문 후보 20개 생성 + 답변 관측 기록 입력(수동 실행 결과 + 캡처 링크).
// 자동 스크래핑은 약관 확인 전 배제(기획서 §8) — 담당자가 실행 결과를 직접 기록한다.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GEO_ENGINES, geoEngineLabels } from "@/domain/sales/geo";
import { generateGeoCandidates, recordGeoAnswer } from "@/server/actions/geo";
import type { GeoQuestionRow } from "@/server/repositories/geo";

const inputCls =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink placeholder:text-slate-400";

export function GeoCandidateGenerator({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function submit(form: FormData) {
    setMsg(null);
    start(async () => {
      const res = await generateGeoCandidates({
        clientId,
        department: String(form.get("department") ?? ""),
        region: String(form.get("region") ?? "")
      });
      if (!res.ok) setMsg(res.error);
      else {
        setMsg(res.data && res.data.created > 0 ? `후보 ${res.data.created}건 생성됨 — 병원 확인 후 일괄 승인하세요.` : "새로 생성된 질문이 없습니다(중복).");
        router.refresh();
      }
    });
  }

  return (
    <form action={submit} className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-panel p-3">
      <label className="min-w-[140px] flex-1 text-xs font-medium text-slate-600">
        진료과
        <input name="department" required maxLength={100} className={`mt-1 ${inputCls}`} placeholder="정형외과" />
      </label>
      <label className="min-w-[140px] flex-1 text-xs font-medium text-slate-600">
        지역
        <input name="region" required maxLength={100} className={`mt-1 ${inputCls}`} placeholder="서울 강남구" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "생성 중…" : "질문 후보 20개 생성"}
      </button>
      {msg && <p className="w-full text-xs text-slate-500">{msg}</p>}
    </form>
  );
}

export function GeoAnswerRecorder({ questions }: { questions: GeoQuestionRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [appeared, setAppeared] = useState(false);
  const [cited, setCited] = useState(false);

  const monitorable = questions.filter((q) => q.status === "APPROVED" || q.status === "MONITORING");
  if (monitorable.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-panel p-3 text-xs text-slate-500">
        승인된 질문이 생기면 여기서 실행 결과를 기록할 수 있습니다.
      </p>
    );
  }

  function submit(form: FormData) {
    setMsg(null);
    start(async () => {
      const competitors = String(form.get("competitors") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await recordGeoAnswer({
        questionId: String(form.get("questionId") ?? ""),
        engine: String(form.get("engine") ?? ""),
        checkedOn: String(form.get("checkedOn") ?? new Date().toISOString().slice(0, 10)),
        appeared,
        cited,
        competitorsMentioned: competitors,
        snippet: String(form.get("snippet") ?? "") || null,
        evidenceUrl: String(form.get("evidenceUrl") ?? "") || null,
        memo: null
      });
      if (!res.ok) setMsg(res.error);
      else {
        setMsg("기록 저장됨");
        setAppeared(false);
        setCited(false);
        router.refresh();
      }
    });
  }

  return (
    <form action={submit} className="space-y-2 rounded-xl border border-line bg-panel p-3">
      <p className="text-xs font-bold text-ink">답변 관측 기록 (수동 실행 결과)</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-600">
          질문
          <select name="questionId" required className={`mt-1 ${inputCls}`}>
            {monitorable.map((q) => (
              <option key={q.id} value={q.id}>
                {q.question.slice(0, 40)}
                {q.question.length > 40 ? "…" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          엔진
          <select name="engine" required className={`mt-1 ${inputCls}`}>
            {GEO_ENGINES.map((e) => (
              <option key={e} value={e}>
                {geoEngineLabels[e]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          실행일
          <input name="checkedOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={`mt-1 ${inputCls}`} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          캡처/증빙 링크
          <input name="evidenceUrl" maxLength={500} className={`mt-1 ${inputCls}`} placeholder="https:// (보관함 파일 링크 등)" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={appeared} onChange={(e) => setAppeared(e.target.checked)} />
          병원 언급(출현)
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={cited} onChange={(e) => setCited(e.target.checked)} disabled={!appeared} />
          공식 URL 인용
        </label>
      </div>
      <label className="block text-xs font-medium text-slate-600">
        답변 발췌 (선택)
        <textarea name="snippet" rows={2} maxLength={2000} className={`mt-1 ${inputCls}`} />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        경쟁사 언급 (쉼표 구분, 선택)
        <input name="competitors" maxLength={500} className={`mt-1 ${inputCls}`} placeholder="OO병원, XX의원" />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "저장 중…" : "기록 저장"}
        </button>
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>
    </form>
  );
}
