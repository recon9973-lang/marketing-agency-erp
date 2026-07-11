"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContract } from "@/server/actions/contracts";

const inputCls = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

type Template = { id: string; name: string; title: string; body: string };

export function CreateContractForm({ clients, templates }: { clients: { id: string; name: string }[]; templates: Template[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // 템플릿 선택 → 본문·계약명 채움. {거래처명}은 선택한 거래처로 치환.
  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const clientName = clients.find((c) => c.id === clientId)?.name ?? "{거래처명}";
    setTitle(tpl.title);
    setBody(tpl.body.replaceAll("{거래처명}", clientName));
  }

  function onSubmit(fd: FormData) {
    setError(null);
    const payload = {
      clientId: String(fd.get("clientId") || ""),
      title: String(fd.get("title") || ""),
      body: String(fd.get("body") || ""),
      amount: fd.get("amount") ? Number(fd.get("amount")) : null,
      startDate: String(fd.get("startDate") || "") || null,
      endDate: String(fd.get("endDate") || "") || null
    };
    start(async () => {
      const res = await createContract(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      if (res.data?.id) router.push(`/contracts/${res.data.id}` as never);
      else router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white">
        + 새 계약서
      </button>
    );
  }

  return (
    <form action={onSubmit} className="rounded-2xl border border-line bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">거래처 *</span>
          <select name="clientId" required value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
            <option value="" disabled>선택</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        {templates.length > 0 ? (
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">서식 템플릿</span>
            <select defaultValue="" onChange={(e) => { applyTemplate(e.target.value); e.target.value = ""; }} className={inputCls}>
              <option value="" disabled>템플릿 선택(선택 시 본문 자동 채움)</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        ) : null}
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">계약명 *</span>
          <input name="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 2026년 블로그 마케팅 대행 계약" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">계약 금액(원)</span>
          <input name="amount" type="number" min="0" step="1" placeholder="예: 3000000" className={inputCls} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">시작일</span>
            <input name="startDate" type="date" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">종료일</span>
            <input name="endDate" type="date" className={inputCls} />
          </label>
        </div>
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-semibold text-slate-500">계약 내용 *</span>
        <textarea name="body" required value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="계약 조항/내용을 입력하거나 위에서 서식 템플릿을 선택하세요." className={`${inputCls} resize-y font-mono text-xs`} />
      </label>
      {error ? (
        <p className="mt-2 text-sm text-danger">{error === "VALIDATION" ? "입력값을 확인해 주세요." : "저장에 실패했습니다."}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "저장 중…" : "계약서 생성"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-line px-4 py-2 text-sm text-slate-600">취소</button>
      </div>
    </form>
  );
}
