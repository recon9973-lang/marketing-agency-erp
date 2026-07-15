"use client";

// 원격 서명 폼 — 고객이 자기 기기에서 이름 입력 + 서명패드로 서명 → signContractByToken.
import { useRef, useState, useTransition } from "react";
import { SignaturePad, type SignaturePadHandle } from "@/components/contracts/SignaturePad";
import { signContractByToken } from "@/server/actions/contracts";

const inputCls = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand";

export function SignClient({ token }: { token: string }) {
  const padRef = useRef<SignaturePadHandle | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit() {
    setErr(null);
    if (!name.trim()) return setErr("서명자 이름을 입력해 주세요.");
    const data = padRef.current?.toDataURL();
    if (!data) return setErr("아래 칸에 서명을 먼저 해주세요.");
    start(async () => {
      const res = await signContractByToken({ token, signerName: name.trim(), signerTitle: title.trim() || null, signatureData: data });
      if (!res.ok) {
        setErr(res.error === "ALREADY_SIGNED" ? "이미 서명이 완료된 계약서입니다." : "서명 저장에 실패했습니다. 다시 시도해 주세요.");
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="mt-6 rounded-2xl bg-white p-8 text-center shadow">
        <div className="text-3xl">✅</div>
        <p className="mt-2 text-lg font-bold text-emerald-600">서명이 완료되었습니다</p>
        <p className="mt-1 text-sm text-slate-500">감사합니다. 계약이 정상 체결되었습니다.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl bg-white p-6 shadow">
      <p className="mb-1 text-base font-bold text-ink">전자 서명</p>
      <p className="mb-4 text-xs text-slate-500">위 계약 내용을 확인하신 후, 아래에 성함을 적고 서명해 주세요.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-500">
          이름
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" className={inputCls} />
        </label>
        <label className="block text-xs font-semibold text-slate-500">
          직함/소속 (선택)
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="대표" className={inputCls} />
        </label>
      </div>
      <div className="mt-4">
        <span className="mb-1 block text-xs font-semibold text-slate-500">서명</span>
        <SignaturePad ref={padRef} />
      </div>
      {err ? <p className="mt-3 text-sm text-rose-600">{err}</p> : null}
      <button type="button" onClick={submit} disabled={pending}
        className="mt-5 w-full rounded-lg bg-brand py-3.5 text-sm font-bold text-white transition hover:bg-brand-strong disabled:opacity-60">
        {pending ? "저장 중…" : "서명 완료 →"}
      </button>
    </div>
  );
}
