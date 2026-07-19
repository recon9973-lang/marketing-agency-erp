"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContract } from "@/server/actions/contracts";
import { SCOPE_ONLINE, SCOPE_OFFLINE, PAY_TERMS_PRESETS, type ContractDetails, type ScopeItem, type ScopeGroup } from "@/domain/contract";

const inputCls = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelCls = "text-xs font-semibold text-slate-500";

type Template = { id: string; name: string; title: string; body: string };
type Mode = "ad" | "free";
// 인계용 거래처 옵션 — 이미 아는 갑 정보를 담아 계약 폼 자동 채움.
type ClientOption = {
  id: string;
  name: string;
  businessNumber?: string | null;
  contactName?: string | null;
  address?: string | null;
  monthlyFee?: number | null;
};

export function CreateContractForm({ clients, templates }: { clients: ClientOption[]; templates: Template[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("ad");

  // 공통 — 거래처: 신규 거래처명(기본) 또는 기존 거래처 선택
  const [clientName, setClientName] = useState("");
  const [existingClientId, setExistingClientId] = useState("");
  const [prefilled, setPrefilled] = useState(false); // 기존 거래처 정보 자동 채움 여부(안내용)
  const [title, setTitle] = useState("광고 업무 대행 계약서");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [months, setMonths] = useState(""); // 계약 개월수(1~24). "" = 종료일 직접지정

  // 시작일 + 개월수 → 종료일(시작일 + N개월 - 1일). 예: 2026-08-01 + 12개월 = 2027-07-31
  function endFromMonths(startStr: string, n: number): string {
    if (!startStr || !n) return "";
    const d = new Date(`${startStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    d.setMonth(d.getMonth() + n);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  function onStartChange(v: string) {
    setStartDate(v);
    if (months) setEndDate(endFromMonths(v, Number(months)));
  }
  function onMonthsChange(v: string) {
    setMonths(v);
    if (v && startDate) setEndDate(endFromMonths(startDate, Number(v)));
  }

  // 광고 대행(구조화) — 대행범위: 선택 항목 + 수량 + 기타(수기)
  const [scopeSel, setScopeSel] = useState<ScopeItem[]>([]);
  const [etcInput, setEtcInput] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientBizNo, setClientBizNo] = useState("");
  const [clientCeo, setClientCeo] = useState("");
  const [vatIncluded, setVatIncluded] = useState(true);
  const [payTerms, setPayTerms] = useState<string>(PAY_TERMS_PRESETS[0]);
  const [autoRenew, setAutoRenew] = useState(true);
  const [special, setSpecial] = useState("");

  // 자유 서식
  const [body, setBody] = useState("");

  // 다음(카카오) 우편번호 서비스 — 버튼 클릭 시 스크립트 지연 로드 후 주소검색 팝업.
  function openPostcode(onDone: (addr: string) => void) {
    const w = window as unknown as { daum?: { Postcode: new (o: unknown) => { open: () => void } } };
    const run = () => new w.daum!.Postcode({
      oncomplete: (data: { roadAddress?: string; jibunAddress?: string }) => onDone(data.roadAddress || data.jibunAddress || "")
    }).open();
    if (w.daum?.Postcode) return run();
    const s = document.createElement("script");
    s.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    s.onload = run;
    s.onerror = () => alert("주소 검색 서비스를 불러오지 못했습니다. 주소를 직접 입력해 주세요.");
    document.body.appendChild(s);
  }

  const hasScope = (label: string) => scopeSel.some((s) => s.label === label);
  function toggleScope(label: string, group: ScopeGroup) {
    setScopeSel((prev) => (prev.some((s) => s.label === label) ? prev.filter((s) => s.label !== label) : [...prev, { label, group, qty: 1 }]));
  }
  function setScopeQty(label: string, qty: number) {
    setScopeSel((prev) => prev.map((s) => (s.label === label ? { ...s, qty: Math.max(1, qty || 1) } : s)));
  }
  function removeScope(label: string) {
    setScopeSel((prev) => prev.filter((s) => s.label !== label));
  }
  function addEtc() {
    const label = etcInput.trim();
    if (!label || hasScope(label)) { setEtcInput(""); return; }
    setScopeSel((prev) => [...prev, { label, group: "etc", qty: 1 }]);
    setEtcInput("");
  }
  // 기존 거래처 선택 → 이미 아는 정보로 빈 칸만 자동 채움(사용자가 입력한 값은 보존).
  function pickExistingClient(id: string) {
    setExistingClientId(id);
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    setClientName(c.name);
    setPrefilled(Boolean(c.businessNumber || c.contactName || c.address || c.monthlyFee != null));
    if (c.monthlyFee != null && !amount) setAmount(String(c.monthlyFee));
    if (c.businessNumber && !clientBizNo) setClientBizNo(c.businessNumber);
    if (c.contactName && !clientCeo) setClientCeo(c.contactName);
    if (c.address && !clientAddress) setClientAddress(c.address);
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
        scopeItems: scopeSel,
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
          <input value={clientName} onChange={(e) => { setClientName(e.target.value); setExistingClientId(""); setPrefilled(false); }} disabled={Boolean(existingClientId)} placeholder="예: 미소진치과 (신규는 계약 생성 시 자동 등록)" className={inputCls} />
          {clients.length > 0 ? (
            <select value={existingClientId} onChange={(e) => { if (e.target.value) pickExistingClient(e.target.value); else { setExistingClientId(""); setPrefilled(false); } }} className={`${inputCls} mt-1.5 text-xs`}>
              <option value="">＋ 신규 거래처로 등록 (위에 이름 입력)</option>
              {clients.map((c) => <option key={c.id} value={c.id}>기존: {c.name}</option>)}
            </select>
          ) : null}
          {prefilled ? <p className="mt-1 text-[11px] font-medium text-emerald-600">✓ 기존 정보(사업자번호·대표자·주소·월광고비)를 불러왔습니다. 필요 시 수정하세요.</p> : null}
        </label>
        <label className="block">
          <span className={labelCls}>계약명 *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>월 광고비(원)</span>
          <input type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="예: 3000000" className={inputCls} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block"><span className={labelCls}>시작일</span><input type="date" value={startDate} onChange={(e) => onStartChange(e.target.value)} className={inputCls} /></label>
          <label className="block"><span className={labelCls}>기간(개월)</span>
            <select value={months} onChange={(e) => onMonthsChange(e.target.value)} className={inputCls}>
              <option value="">직접</option>
              {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}개월</option>)}
            </select>
          </label>
          <label className="block"><span className={labelCls}>종료일</span><input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setMonths(""); }} className={inputCls} /></label>
        </div>
      </div>

      {mode === "ad" ? (
        <div className="mt-4 space-y-4">
          {/* 갑 정보 */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block md:col-span-1">
              <span className={labelCls}>갑 주소</span>
              <div className="mt-1 flex gap-1.5">
                <input value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand" placeholder="주소 찾기로 입력" />
                <button type="button" onClick={() => openPostcode((addr) => setClientAddress(addr))} className="shrink-0 rounded-md border border-line px-2.5 text-xs text-slate-600 hover:border-brand">주소 찾기</button>
              </div>
            </label>
            <label className="block"><span className={labelCls}>갑 사업자번호</span><input value={clientBizNo} onChange={(e) => setClientBizNo(e.target.value)} className={inputCls} /></label>
            <label className="block"><span className={labelCls}>갑 대표자</span><input value={clientCeo} onChange={(e) => setClientCeo(e.target.value)} className={inputCls} /></label>
          </div>

          {/* 대행 범위 — 선택(칩) + 수량 + 기타(수기) */}
          <div>
            <p className={labelCls}>대행 범위 — 온라인 (클릭하여 선택)</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SCOPE_ONLINE.map((s) => (
                <button key={s} type="button" onClick={() => toggleScope(s, "online")}
                  className={`rounded-full border px-2.5 py-1 text-xs ${hasScope(s) ? "border-brand bg-brand/10 text-brand" : "border-line text-slate-600 hover:border-brand"}`}>{s}</button>
              ))}
            </div>
            <p className={`${labelCls} mt-3`}>대행 범위 — 오프라인</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SCOPE_OFFLINE.map((s) => (
                <button key={s} type="button" onClick={() => toggleScope(s, "offline")}
                  className={`rounded-full border px-2.5 py-1 text-xs ${hasScope(s) ? "border-brand bg-brand/10 text-brand" : "border-line text-slate-600 hover:border-brand"}`}>{s}</button>
              ))}
            </div>
            <p className={`${labelCls} mt-3`}>기타 (직접 입력)</p>
            <div className="mt-1.5 flex gap-1.5">
              <input value={etcInput} onChange={(e) => setEtcInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEtc(); } }} placeholder="예: 유튜브 채널 운영" className="w-64 max-w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand" />
              <button type="button" onClick={addEtc} className="shrink-0 rounded-md border border-line px-3 text-sm text-slate-600 hover:border-brand">추가</button>
            </div>

            {/* 선택 항목 · 수량 */}
            {scopeSel.length > 0 ? (
              <div className="mt-3 space-y-1.5 rounded-lg border border-line bg-surface/50 p-2.5">
                <p className="text-[11px] font-semibold text-slate-500">선택 항목 · 수량 (계약서엔 이 항목만 출력)</p>
                {scopeSel.map((it) => (
                  <div key={it.label} className="flex items-center gap-2 text-sm">
                    <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-400">{it.group === "online" ? "온라인" : it.group === "offline" ? "오프라인" : "기타"}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{it.label}</span>
                    <span className="text-xs text-slate-500">수량</span>
                    <input type="number" min={1} value={it.qty} onChange={(e) => setScopeQty(it.label, Number(e.target.value))} className="w-16 rounded border border-line px-1.5 py-1 text-sm" />
                    <button type="button" onClick={() => removeScope(it.label)} className="rounded px-1.5 text-slate-400 hover:text-danger" aria-label="삭제">×</button>
                  </div>
                ))}
              </div>
            ) : null}
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
