// 목표 경로: src/components/survey/PublicSurveyForm.tsx
//
// 외부(거래처) 설문 응답 폼 — 로그인 불필요. publicToken으로 제출.
"use client";

import { useState, useTransition } from "react";
import { submitSurveyResponse } from "@/server/actions/surveys";

type Question = { id: string; label: string; type: string; options?: string[]; required?: boolean; default?: string; allowOther?: boolean };

const OTHER = "__other__";

const inputCls = "mt-1 w-full rounded-md border border-line px-3 py-2.5 text-sm text-ink outline-none focus:border-brand";

export function PublicSurveyForm({ token, questions }: { token: string; questions: Question[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // 계약서에서 동기화된 기본값으로 초기화(수정 가능).
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of questions) if (q.default?.trim()) init[q.id] = q.default;
    return init;
  });
  // choice 문항에서 "기타(직접 입력)"가 선택된 항목 추적.
  const [otherOn, setOtherOn] = useState<Record<string, boolean>>({});

  function submit() {
    setError(null);
    const missing = questions.find((q) => q.required && !values[q.id]?.trim());
    if (missing) {
      setError(`'${missing.label}' 항목을 입력해 주세요.`);
      return;
    }
    start(async () => {
      const res = await submitSurveyResponse({ token, answers: values });
      if (!res.ok) {
        setError(res.error === "ALREADY_SUBMITTED" ? "이미 제출된 설문입니다." : "제출에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center">
        <p className="text-2xl">✅</p>
        <p className="mt-2 text-lg font-bold text-ink">제출되었습니다</p>
        <p className="mt-1 text-sm text-slate-500">소중한 답변 감사합니다. 담당자가 확인 후 진행하겠습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((q) => (
        <div key={q.id} className="rounded-2xl border border-line bg-white p-4">
          <label className="block">
            <span className="text-sm font-semibold text-ink">
              {q.label}
              {q.required ? <span className="ml-1 text-danger">*</span> : null}
              {q.default?.trim() ? <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-strong">계약서 자동입력</span> : null}
            </span>
            {q.type === "textarea" ? (
              <textarea value={values[q.id] ?? ""} onChange={(e) => setValues({ ...values, [q.id]: e.target.value })} rows={3} className={`${inputCls} resize-y`} />
            ) : q.type === "choice" ? (
              <>
                <select
                  value={otherOn[q.id] ? OTHER : (values[q.id] ?? "")}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === OTHER) {
                      setOtherOn({ ...otherOn, [q.id]: true });
                      setValues({ ...values, [q.id]: "" });
                    } else {
                      setOtherOn({ ...otherOn, [q.id]: false });
                      setValues({ ...values, [q.id]: val });
                    }
                  }}
                  className={inputCls}
                >
                  <option value="">선택</option>
                  {(q.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  {q.allowOther ? <option value={OTHER}>기타(직접 입력)</option> : null}
                </select>
                {q.allowOther && otherOn[q.id] ? (
                  <input value={values[q.id] ?? ""} onChange={(e) => setValues({ ...values, [q.id]: e.target.value })} placeholder="직접 입력해 주세요" className={`${inputCls} mt-2`} autoFocus />
                ) : null}
              </>
            ) : (
              <input value={values[q.id] ?? ""} onChange={(e) => setValues({ ...values, [q.id]: e.target.value })} className={inputCls} />
            )}
          </label>
        </div>
      ))}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button type="button" onClick={submit} disabled={pending} className="w-full rounded-md bg-brand px-4 py-3 text-base font-bold text-white disabled:opacity-50">
        {pending ? "제출 중…" : "제출하기"}
      </button>
    </div>
  );
}
