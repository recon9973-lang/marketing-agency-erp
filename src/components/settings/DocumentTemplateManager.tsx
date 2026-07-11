// 목표 경로: src/components/settings/DocumentTemplateManager.tsx
//
// 서식(문서 템플릿) 관리 — 추가/수정/삭제. 사용처(category)·사용 권한(minRole) 지정.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { saveDocumentTemplate, deleteDocumentTemplate } from "@/server/actions/document-templates";

type Template = {
  id: string;
  name: string;
  category: "CONTRACT" | "CLIENT" | "HR" | "GENERAL";
  title: string;
  body: string;
  minRole: "SUPER_ADMIN" | "ADMIN" | "MARKETER";
  isActive: boolean;
  sortOrder: number;
};

const CATEGORY_LABEL: Record<Template["category"], string> = {
  CONTRACT: "계약서",
  CLIENT: "거래처",
  HR: "인사",
  GENERAL: "일반"
};
const ROLE_LABEL: Record<Template["minRole"], string> = {
  SUPER_ADMIN: "최고관리자",
  ADMIN: "관리자",
  MARKETER: "담당자"
};

const CATEGORIES: Template["category"][] = ["CONTRACT", "CLIENT", "HR", "GENERAL"];
const inputCls = "w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

const emptyDraft = (): Partial<Template> => ({ name: "", category: "CONTRACT", title: "", body: "", minRole: "MARKETER", isActive: true, sortOrder: 0 });

export function DocumentTemplateManager({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Partial<Template> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!draft) return;
    setError(null);
    if (!draft.name?.trim() || !draft.title?.trim() || !draft.body?.trim()) {
      setError("이름·제목·본문을 입력하세요.");
      return;
    }
    start(async () => {
      const res = await saveDocumentTemplate({
        id: draft.id,
        name: draft.name,
        category: draft.category,
        title: draft.title,
        body: draft.body,
        minRole: draft.minRole,
        sortOrder: draft.sortOrder ?? 0,
        isActive: draft.isActive ?? true
      });
      if (!res.ok) {
        setError("저장에 실패했습니다.");
        return;
      }
      setDraft(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("이 서식을 삭제할까요?")) return;
    start(async () => {
      const res = await deleteDocumentTemplate({ id });
      if (!res.ok) setError("삭제에 실패했습니다.");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">계약서·비밀유지·근로계약 등 서식을 관리합니다. 사용처와 사용 권한을 지정하면 해당 화면에서만 노출됩니다.</p>
        {!draft ? (
          <button type="button" onClick={() => setDraft(emptyDraft())} className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> 서식 추가
          </button>
        ) : null}
      </div>

      {draft ? (
        <div className="rounded-2xl border border-line bg-white p-4">
          <h4 className="mb-3 text-sm font-bold text-ink">{draft.id ? "서식 수정" : "새 서식"}</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">서식 이름 *</span>
              <input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">문서 제목 *</span>
              <input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">사용처(카테고리)</span>
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Template["category"] })} className={inputCls}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">사용 권한(이상)</span>
              <select value={draft.minRole} onChange={(e) => setDraft({ ...draft, minRole: e.target.value as Template["minRole"] })} className={inputCls}>
                <option value="MARKETER">담당자 이상(전체)</option>
                <option value="ADMIN">관리자 이상</option>
                <option value="SUPER_ADMIN">최고관리자만</option>
              </select>
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-xs font-semibold text-slate-500">본문 * <span className="font-normal text-slate-400">— {"{중괄호}"}는 사용 시 채우는 자리표시자</span></span>
            <textarea value={draft.body ?? ""} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={10} className={`${inputCls} resize-y font-mono text-xs`} />
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={draft.isActive ?? true} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> 활성(사용 화면에 노출)
          </label>
          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={save} disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "저장 중…" : "저장"}</button>
            <button type="button" onClick={() => { setDraft(null); setError(null); }} className="rounded-md border border-line px-4 py-2 text-sm text-slate-600">취소</button>
          </div>
        </div>
      ) : null}

      {/* 카테고리별 목록 */}
      {CATEGORIES.map((cat) => {
        const rows = templates.filter((t) => t.category === cat);
        if (rows.length === 0) return null;
        return (
          <div key={cat} className="space-y-1.5">
            <p className="text-xs font-bold text-slate-500">{CATEGORY_LABEL[cat]}</p>
            {rows.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {t.name}
                    {!t.isActive ? <span className="ml-2 text-xs font-normal text-slate-400">(비활성)</span> : null}
                  </p>
                  <p className="text-xs text-slate-400">{ROLE_LABEL[t.minRole]} 이상 사용</p>
                </div>
                <button type="button" onClick={() => setDraft(t)} className="text-slate-400 hover:text-brand-strong" aria-label="수정"><Pencil className="h-4 w-4" /></button>
                <button type="button" onClick={() => remove(t.id)} disabled={pending} className="text-slate-400 hover:text-danger disabled:opacity-50" aria-label="삭제"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
