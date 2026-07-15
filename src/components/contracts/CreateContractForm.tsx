"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContract } from "@/server/actions/contracts";
import { SCOPE_ONLINE, SCOPE_OFFLINE, PAY_TERMS_PRESETS, type ContractDetails } from "@/domain/contract";

const inputCls = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelCls = "text-xs font-semibold text-slate-500";

type Template = { id: string; name: string; title: string; body: string };
type Mode = "ad" | "free";

export function CreateContractForm({ clients, templates }: { clients: { id: string; name: string }[]; templates: Template[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("ad");

  // 공통 — 거래처: 신규 거래처명(기본) 또는 기존 거래처 선택
  const [clientName, setClientName] = useState("");
  const [existingClientId, setExistingClientId] = useState("");
  const [title, setTitle] = useState("광고 업무 대행 계약서");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 광고 대행(구조화)
  const [scopeOnline, setScopeOnline] = useState<string[]>([]);
  const [scopeOffline, setScopeOffline] = useState<string[]>([]);
  const [clientAddress, setClientAddress] = useState("");
  const [clientBizNo, setClientBizNo] = useState("");
  const [clientCeo, setClientCeo] = useState("");
  const [vatIncluded, setVatIncluded] = useState(true);
  const [payTerms, setPayTerms] = useState<string>(PAY_TERMS_PRESETS[0]);
  const [autoRenew, setAutoRenew] = useState(true);
  const [special, setSpecial] = useState("");

  // 자유 서식
  const [body, setBody] = useState("");

  function toggle(list: string[], setList: (v: string[]) => void, v: string) {
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }
  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const nm = existingClientId ? clients.find((c) => c.id === existingClientId)?.name ?? clientName : clientName || "{거래처명}";
    setTitle(tpl.title);
    setBody(tpl.body.replaceAll("{거래처명}", nm));
  }

  function submit() {
    setError(null);
    const useExisting = Boolean(existingClientId);
    if (!useExisting && !clientName.trim()) return setError("거래처명을 입력하세요.");
    if (!title.trim()) return setError("계약명을 입력하세요.");
    const base = {
      ...(useExisting ? { clientId: existingClientId } : { clientName: clientName.trim() }),
      title: title.trim(),
      amount: amount ? Number(amount) : null,
      startDate: startDate || null,
      endDate: endDate || null
    };
    let payload: Record<string, unknown>;
    if (mode === "ad") {
      const details: ContractDetails = {
        clientAddress: clientAddress.trim() || undefined,
        clientBizNo: clientBizNo.trim() || undefined,
        clientCeo: clientCeo.trim() || undefined,
        scopeOnline,
        scopeOffline,
        vatIncluded,
        payTerms: payTerms.trim() || undefined,
        autoRenew,
        special: special.trim() || undefined
      };
      payload = { ...base, details };
    } else {
      if (!body.trim()) return setError("계약 내용을 입력하세요.");
      payload = { ...base, body };
    }
    start(async () => {
      const res = await createContract(payload);
      if (!res.ok) { setError(res.error === "VALIDATION" ? "입력값을 확인해 주세요." : "저장에 실패했습니다."); return; }
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
    <div className="rounded-2xl border border-line bg-white p-4">
      {/* 모드 탭 */}
      <div className="mb-4 inline-flex rounded-lg border border-line p-0.5 text-sm">
        <button type="button" onClick={() => { setMode("ad"); setTitle("광고 업무 대행 계약서"); }}
          className={mode === "ad" ? "rounded-md bg-brand px-3 py-1.5 font-semibold text-white" : "px-3 py-1.5 text-slate-600"}>광고 대행 계약(항목별)</button>
        <button type="button" onClick={() => setMode("free")}
          className={mode === "free" ? "rounded-md bg-brand px-3 py-1.5 font-semibold text-white" : "px-3 py-1.5 text-slate-600"}>일반 서식(템플릿)</button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className={labelCls}>거래처명(갑) *</span>
          <input value={clientName} onChange={(e) => { setClientName(e.target.value); setExistingClientId(""); }} disabled={Boolean(existingClientId)} placeholder="예: 미소진치과 (신규는 계약 생성 시 자동 등록)" className={inputCls} />
          {clients.length > 0 ? (
            <select value={existingClientId} onChange={(e) => { setExistingClientId(e.target.value); const c = clients.find((x) => x.id === e.target.value); if (c) setClientName(c.name); }} className={`${inputCls} mt-1.5 text-xs`}>
              <option value="">＋ 신규 거래처로 등록 (위에 이름 입력)</option>
              {clients.map((c) => <option key={c.id} value={c.id}>기존: {c.name}</option>)}
            </select>
          ) : null}
        </label>
        <label className="block">
          <span className={labelCls}>계약명 *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>월 광고비(원)</span>
          <input type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="예: 3000000" className={inputCls} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className={labelCls}>시작일</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} /></label>
          <label className="block"><span className={labelCls}>종료일</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} /></label>
        </div>
      </div>

      {mode === "ad" ? (
        <div className="mt-4 space-y-4">
          {/* 갑 정보 */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block"><span className={labelCls}>갑 주소</span><input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className={inputCls} /></label>
            <label className="block"><span className={labelCls}>갑 사업자번호</span><input value={clientBizNo} onChange={(e) => setClientBizNo(e.target.value)} className={inputCls} /></label>
            <label className="block"><span className={labelCls}>갑 대표자</span><input value={clientCeo} onChange={(e) => setClientCeo(e.target.value)} className={inputCls} /></label>
          </div>
          {/* 대행 범위 */}
          <div>
            <p className={labelCls}>대행 범위 — 온라인</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SCOPE_ONLINE.map((s) => (
                <button key={s} type="button" onClick={() => toggle(scopeOnline, setScopeOnline, s)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${scopeOnline.includes(s) ? "border-brand bg-brand/10 text-brand" : "border-line text-slate-600 hover:border-brand"}`}>{s}</button>
              ))}
            </div>
            <p className={`${labelCls} mt-3`}>대행 범위 — 오프라인</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SCOPE_OFFLINE.map((s) => (
                <button key={s} type="button" onClick={() => toggle(scopeOffline, setScopeOffline, s)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${scopeOffline.includes(s) ? "border-brand bg-brand/10 text-brand" : "border-line text-slate-600 hover:border-brand"}`}>{s}</button>
              ))}
            </div>
          </div>
          {/* 조건 */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <span className={labelCls}>지불조건</span>
              <select value={payTerms} onChange={(e) => setPayTerms(e.target.value)} className={inputCls}>
                {PAY_TERMS_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <div className="flex items-end gap-4 pb-1">
              <label className="inline-flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={vatIncluded} onChange={(e) => setVatIncluded(e.target.checked)} /> VAT 포함</label>
              <label className="inline-flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} /> 1년 자동갱신</label>
            </div>
          </div>
          <label className="block">
            <span className={labelCls}>특약사항 (선택)</span>
            <textarea value={special} onChange={(e) => setSpecial(e.target.value)} rows={2} className={`${inputCls} resize-y`} placeholder="추가 합의 사항이 있으면 입력" />
          </label>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {templates.length > 0 ? (
            <label className="block">
              <span className={labelCls}>서식 템플릿</span>
              <select defaultValue="" onChange={(e) => { applyTemplate(e.target.value); e.target.value = ""; }} className={inputCls}>
                <option value="" disabled>템플릿 선택(선택 시 본문 자동 채움)</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="block">
            <span className={labelCls}>계약 내용 *</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="계약 조항/내용을 입력하거나 위에서 서식 템플릿을 선택하세요." className={`${inputCls} resize-y font-mono text-xs`} />
          </label>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={submit} disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "저장 중…" : "계약서 생성"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-line px-4 py-2 text-sm text-slate-600">취소</button>
      </div>
    </div>
  );
}
