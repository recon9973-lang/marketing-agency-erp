// 목표 경로: src/components/magazine/MagazineImport.tsx
//
// 용어 리스트 대량 등록 폼 — 카테고리·유형 선택 + 붙여넣기 → 큐잉.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MAGAZINE_CATEGORIES, MAGAZINE_KINDS, magazineKindLabels } from "@/domain/content/magazine";
import { importMagazineQueue } from "@/server/actions/magazine";

const inputCls =
  "w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none";

export function MagazineImport() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function submit(form: FormData) {
    setMsg(null);
    setErr(null);
    start(async () => {
      const res = await importMagazineQueue({
        category: String(form.get("category") ?? ""),
        kind: String(form.get("kind") ?? ""),
        raw: String(form.get("raw") ?? "")
      });
      if (!res.ok) setErr(res.error);
      else if (res.data) {
        setMsg(`${res.data.parsed}개 인식 · ${res.data.created}개 큐 등록${res.data.skipped ? ` · 중복 ${res.data.skipped}개 건너뜀` : ""}`);
        router.refresh();
      }
    });
  }

  return (
    <form action={submit} className="rounded-2xl border border-line bg-card p-4">
      <p className="text-sm font-bold text-ink">용어·주제 대량 등록</p>
      <p className="mt-0.5 text-[11px] text-slate-400">
        한 줄에 하나씩. <code className="rounded bg-surface px-1">용어 — 정의</code> 또는 <code className="rounded bg-surface px-1">용어 :: 정의</code> 형식, 번호·굵게(**)는 자동 제거됩니다.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-600">
          카테고리
          <select name="category" className={`mt-1 ${inputCls}`} defaultValue={MAGAZINE_CATEGORIES[0]}>
            {MAGAZINE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          유형
          <select name="kind" className={`mt-1 ${inputCls}`} defaultValue="glossary">
            {MAGAZINE_KINDS.map((k) => (
              <option key={k} value={k}>{magazineKindLabels[k]}</option>
            ))}
          </select>
        </label>
      </div>
      <textarea
        name="raw"
        required
        rows={7}
        maxLength={50000}
        className={`mt-2 ${inputCls} font-mono text-[13px]`}
        placeholder={"GEO(생성형 엔진 최적화) — 생성형 AI 답변에 인용되게 만드는 최적화\nAEO(답변 엔진 최적화) — 검색·AI의 답변 영역에 선택되게 하는 최적화"}
      />
      <div className="mt-2 flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {pending ? "등록 중…" : "큐에 등록"}
        </button>
        {msg && <span className="text-xs font-semibold text-emerald-700">{msg}</span>}
        {err && <span className="text-xs text-rose-600">{err}</span>}
      </div>
    </form>
  );
}
