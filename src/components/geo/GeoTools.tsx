// 목표 경로: src/components/geo/GeoTools.tsx
//
// GEO 도구 모음 — 질문 후보 20개 생성 + 답변 관측 기록 입력(수동 실행 결과 + 캡처 링크).
// 자동 스크래핑은 약관 확인 전 배제(기획서 §8) — 담당자가 실행 결과를 직접 기록한다.
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GEO_ENGINES, geoEngineLabels } from "@/domain/sales/geo";
import { addGeoQuestion, generateGeoCandidates, recordGeoAnswer } from "@/server/actions/geo";
import type { GeoQuestionRow } from "@/server/repositories/geo";

const inputCls =
  "w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none";
const primaryBtnCls =
  "rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50";

export function GeoCandidateGenerator({
  clientId,
  defaultDepartment = "",
  defaultRegion = ""
}: {
  clientId: string;
  defaultDepartment?: string;
  defaultRegion?: string;
}) {
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
    <form action={submit} className="rounded-2xl border border-line bg-card p-4" key={clientId}>
      <p className="text-sm font-bold text-ink">질문 후보 자동 생성</p>
      <p className="mt-0.5 text-[11px] text-slate-400">SOP 5유형(정의·판단·비교·위험·지역) × 진료과·지역 조합으로 후보 20개를 만듭니다.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-[140px] flex-1 text-xs font-medium text-slate-600">
          진료과
          <input name="department" required maxLength={100} defaultValue={defaultDepartment} className={`mt-1 ${inputCls}`} placeholder="정형외과" />
        </label>
        <label className="min-w-[140px] flex-1 text-xs font-medium text-slate-600">
          지역
          <input name="region" required maxLength={100} defaultValue={defaultRegion} className={`mt-1 ${inputCls}`} placeholder="서울 강남구" />
        </label>
        <button type="submit" disabled={pending} className={primaryBtnCls}>
          {pending ? "생성 중…" : "질문 후보 20개 생성"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        {defaultDepartment || defaultRegion
          ? "거래처 정보에서 자동으로 채웠습니다 — 필요하면 수정 후 생성하세요."
          : "거래처에 진료과·지역을 등록하면 자동으로 채워집니다."}
      </p>
      {msg && <p className="mt-1 text-xs text-emerald-700">{msg}</p>}
    </form>
  );
}

/** 질문 직접 추가 — 병원 특화 질문(위험표현 감지 시 서버에서 차단). */
export function GeoQuestionAdder({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function submit(form: FormData) {
    setMsg(null);
    start(async () => {
      const res = await addGeoQuestion({
        clientId,
        question: String(form.get("question") ?? ""),
        qtype: (String(form.get("qtype") ?? "") || null) as "정의형" | "판단형" | "비교형" | "위험형" | "지역형" | null,
        targetPageUrl: String(form.get("targetPageUrl") ?? "") || null,
        priority: Number(form.get("priority") ?? 3)
      });
      if (!res.ok) setMsg(res.error);
      else {
        setMsg("질문이 후보로 추가됐습니다 — 병원 확인 후 승인하세요.");
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm font-bold text-ink" aria-expanded={open}>
        {open ? "− 질문 직접 추가 닫기" : "+ 질문 직접 추가 (병원 특화)"}
      </button>
      {open && (
        <form action={submit} className="mt-3 space-y-2">
          <label className="block text-xs font-medium text-slate-600">
            질문 *
            <input name="question" required minLength={5} maxLength={300} className={`mt-1 ${inputCls}`} placeholder="도수치료 후 통증은 언제까지 지속되나요?" />
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-600">
              유형
              <select name="qtype" className={`mt-1 ${inputCls}`} defaultValue="">
                <option value="">미지정</option>
                <option value="정의형">정의형</option>
                <option value="판단형">판단형</option>
                <option value="비교형">비교형</option>
                <option value="위험형">위험형</option>
                <option value="지역형">지역형</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              우선순위
              <select name="priority" className={`mt-1 ${inputCls}`} defaultValue="3">
                <option value="1">1 (높음)</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5 (낮음)</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              대응 페이지 URL
              <input name="targetPageUrl" maxLength={500} className={`mt-1 ${inputCls}`} placeholder="https://" />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending} className={primaryBtnCls}>
              {pending ? "추가 중…" : "후보로 추가"}
            </button>
            {msg && <span className="text-xs text-slate-500">{msg}</span>}
          </div>
        </form>
      )}
    </div>
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
      <p className="rounded-2xl border border-line bg-card p-6 text-center text-xs text-slate-500">
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
    <form action={submit} className="space-y-2 rounded-2xl border border-line bg-card p-4">
      <p className="text-sm font-bold text-ink">답변 관측 기록 (수동 실행 결과)</p>
      <p className="text-[11px] text-slate-400">직접 AI에 질문해 본 결과를 남깁니다 — 자동 관측이 켜져 있으면 보조 용도입니다.</p>
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
          <Link href="/vault" className="mt-0.5 inline-block text-[10px] text-emerald-700 hover:underline">
            보관함에 캡처 올리기 ↗
          </Link>
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
        <button type="submit" disabled={pending} className={primaryBtnCls}>
          {pending ? "저장 중…" : "기록 저장"}
        </button>
        {msg && <span className="text-xs text-emerald-700">{msg}</span>}
      </div>
    </form>
  );
}
