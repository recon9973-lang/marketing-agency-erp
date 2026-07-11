"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteContract, signContract, updateContract } from "@/server/actions/contracts";
import { SignaturePad, type SignaturePadHandle } from "@/components/contracts/SignaturePad";

const inputCls = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

type Contract = {
  id: string;
  clientName: string;
  authorName: string;
  title: string;
  body: string;
  amount: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  signerName: string | null;
  signerTitle: string | null;
  signatureData: string | null;
  signedAt: Date | null;
  createdAt: Date;
};

const won = new Intl.NumberFormat("ko-KR");
const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });
function fmtDate(d: Date | null) {
  return d ? dateFmt.format(new Date(d)) : "-";
}

export function ContractDetailView({ contract, canDelete }: { contract: Contract; canDelete: boolean }) {
  const router = useRouter();
  const signed = contract.status === "SIGNED";
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 서명 상태
  const padRef = useRef<SignaturePadHandle | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");

  function onSave(fd: FormData) {
    setError(null);
    const payload = {
      id: contract.id,
      title: String(fd.get("title") || ""),
      body: String(fd.get("body") || ""),
      amount: fd.get("amount") ? Number(fd.get("amount")) : null,
      startDate: String(fd.get("startDate") || "") || null,
      endDate: String(fd.get("endDate") || "") || null
    };
    start(async () => {
      const res = await updateContract(payload);
      if (!res.ok) return setError("저장에 실패했습니다.");
      setEditing(false);
      router.refresh();
    });
  }

  function onSign() {
    setError(null);
    const data = padRef.current?.toDataURL();
    if (!signerName.trim()) return setError("서명자 이름을 입력하세요.");
    if (!data) return setError("서명(사인)을 먼저 해주세요.");
    start(async () => {
      const res = await signContract({ id: contract.id, signerName, signerTitle: signerTitle || null, signatureData: data });
      if (!res.ok) return setError(res.error === "VALIDATION" ? "입력값을 확인해 주세요." : "서명 저장에 실패했습니다.");
      router.refresh();
    });
  }

  function onDelete() {
    if (!confirm("이 계약서를 삭제할까요? 되돌릴 수 없습니다.")) return;
    start(async () => {
      const res = await deleteContract({ id: contract.id });
      if (!res.ok) return setError("삭제에 실패했습니다.");
      router.push("/contracts");
    });
  }

  return (
    <div className="space-y-6">
      {/* 상단 액션 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span
            className={
              signed
                ? "rounded-md bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-strong"
                : "rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-slate-600"
            }
          >
            {signed ? "✓ 서명 완료" : "미서명 (초안)"}
          </span>
          <span className="ml-2 text-xs text-slate-500">거래처: {contract.clientName} · 작성: {contract.authorName}</span>
        </div>
        <div className="flex gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="rounded-md border border-line px-3 py-2 text-sm text-slate-700 hover:bg-surface">인쇄/PDF</button>
          {!signed && !editing ? (
            <button type="button" onClick={() => setEditing(true)} className="rounded-md border border-line px-3 py-2 text-sm text-slate-700 hover:bg-surface">내용 수정</button>
          ) : null}
          {canDelete ? (
            <button type="button" onClick={onDelete} disabled={pending} className="rounded-md border border-danger px-3 py-2 text-sm font-semibold text-danger hover:bg-red-50 disabled:opacity-50">삭제</button>
          ) : null}
        </div>
      </div>

      {/* 계약 본문 */}
      {editing ? (
        <form action={onSave} className="rounded-2xl border border-line bg-white p-5">
          <label className="block"><span className="text-xs font-semibold text-slate-500">계약명 *</span>
            <input name="title" required defaultValue={contract.title} className={inputCls} /></label>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <label className="block"><span className="text-xs font-semibold text-slate-500">금액(원)</span>
              <input name="amount" type="number" min="0" defaultValue={contract.amount ?? ""} className={inputCls} /></label>
            <label className="block"><span className="text-xs font-semibold text-slate-500">시작일</span>
              <input name="startDate" type="date" defaultValue={contract.startDate ? new Date(contract.startDate).toISOString().slice(0, 10) : ""} className={inputCls} /></label>
            <label className="block"><span className="text-xs font-semibold text-slate-500">종료일</span>
              <input name="endDate" type="date" defaultValue={contract.endDate ? new Date(contract.endDate).toISOString().slice(0, 10) : ""} className={inputCls} /></label>
          </div>
          <label className="mt-3 block"><span className="text-xs font-semibold text-slate-500">계약 내용 *</span>
            <textarea name="body" required rows={8} defaultValue={contract.body} className={`${inputCls} resize-y`} /></label>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "저장 중…" : "저장"}</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-line px-4 py-2 text-sm text-slate-600">취소</button>
          </div>
        </form>
      ) : (
        <article className="rounded-2xl border border-line bg-white p-6 md:p-8">
          <h1 className="text-2xl font-bold text-ink">{contract.title}</h1>
          <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-3">
            <div><dt className="text-xs text-slate-500">거래처</dt><dd className="font-medium text-ink">{contract.clientName}</dd></div>
            <div><dt className="text-xs text-slate-500">계약 금액</dt><dd className="font-medium text-ink">{contract.amount ? `${won.format(Number(contract.amount))}원` : "-"}</dd></div>
            <div><dt className="text-xs text-slate-500">계약 기간</dt><dd className="font-medium text-ink">{fmtDate(contract.startDate)} ~ {fmtDate(contract.endDate)}</dd></div>
          </dl>
          <div className="mt-6 whitespace-pre-wrap border-t border-line pt-6 text-sm leading-7 text-slate-700">{contract.body}</div>

          {/* 서명란 */}
          <div className="mt-8 border-t border-line pt-6">
            {signed ? (
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <p className="text-xs text-slate-500">서명자</p>
                  <p className="text-base font-semibold text-ink">
                    {contract.signerName}{contract.signerTitle ? ` (${contract.signerTitle})` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">서명일: {fmtDate(contract.signedAt)}</p>
                </div>
                {contract.signatureData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={contract.signatureData} alt="서명" className="h-24 rounded-md border border-line bg-white object-contain px-2" />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-500">아직 서명되지 않았습니다. 아래에서 태블릿으로 서명하세요.</p>
            )}
          </div>
        </article>
      )}

      {/* 서명 패널 (미서명 + 편집중 아님) */}
      {!signed && !editing ? (
        <section className="rounded-2xl border border-line bg-white p-5 print:hidden">
          <h3 className="text-sm font-bold text-ink">✍️ 태블릿 서명</h3>
          <p className="mt-1 text-xs text-slate-500">서명자 정보를 입력하고 아래 칸에 사인하면 계약이 <b>서명 완료</b>로 확정됩니다.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-xs font-semibold text-slate-500">서명자 이름 *</span>
              <input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="예: 홍길동" className={inputCls} /></label>
            <label className="block"><span className="text-xs font-semibold text-slate-500">직함/소속</span>
              <input value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} placeholder="예: OO치과 대표원장" className={inputCls} /></label>
          </div>
          <div className="mt-3">
            <SignaturePad ref={padRef} height={200} />
          </div>
          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          <button type="button" onClick={onSign} disabled={pending} className="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {pending ? "서명 저장 중…" : "서명 완료 확정"}
          </button>
        </section>
      ) : null}
      {error && (signed || editing) ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
