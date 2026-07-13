// 브랜드킷 관리 — 조직/거래처별 컬러·폰트 저장. 디자인 스튜디오 색 팔레트로 쓰인다.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, Palette } from "lucide-react";
import { createBrandKit, deleteBrandKit } from "@/server/actions/brand-kits";
import type { BrandKitItem } from "@/server/repositories/brand-kits";

type Client = { id: string; name: string };

const inputCls = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export function BrandKitManager({ initialKits, clients }: { initialKits: BrandKitItem[]; clients: Client[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [fontFamily, setFontFamily] = useState("");
  const [colors, setColors] = useState<string[]>(["#d9662e"]);
  const [picker, setPicker] = useState("#3b82f6");

  function addColor() {
    const c = picker.toLowerCase();
    if (!colors.includes(c)) setColors((p) => [...p, c].slice(0, 12));
  }

  function save() {
    setError(null);
    if (!name.trim()) { setError("이름을 입력하세요."); return; }
    start(async () => {
      const res = await createBrandKit({ name, clientId: clientId || null, colors, fontFamily: fontFamily || null });
      if (!res.ok) setError(res.error);
      else {
        setName(""); setClientId(""); setFontFamily(""); setColors(["#d9662e"]);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!confirm("이 브랜드킷을 삭제할까요?")) return;
    start(async () => {
      const res = await deleteBrandKit({ id });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
      {/* 목록 */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-ink">저장된 브랜드킷 ({initialKits.length})</h2>
        {initialKits.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-slate-400">
            아직 브랜드킷이 없습니다. 오른쪽에서 첫 브랜드킷을 만드세요.
          </p>
        ) : (
          <ul className="space-y-3">
            {initialKits.map((k) => (
              <li key={k.id} className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-brand" />
                  <span className="text-sm font-bold text-ink">{k.name}</span>
                  {k.clientName ? <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand-strong">{k.clientName}</span> : <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-slate-400">공통</span>}
                  <button type="button" onClick={() => remove(k.id)} disabled={pending} className="ml-auto rounded-md p-1 text-slate-400 hover:text-rose-500" aria-label="삭제"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {k.colors.length === 0 ? <span className="text-xs text-slate-400">색상 없음</span> : k.colors.map((c) => (
                    <span key={c} className="flex items-center gap-1 rounded-md border border-line px-1.5 py-1 text-[11px] text-slate-500">
                      <span className="h-4 w-4 rounded" style={{ background: c }} /> {c}
                    </span>
                  ))}
                </div>
                {k.fontFamily ? <p className="mt-2 text-xs text-slate-500">폰트: {k.fontFamily}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 생성 폼 */}
      <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-sm font-bold text-ink">새 브랜드킷</h2>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">이름</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 미소진치과 브랜드" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">거래처(선택)</span>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
            <option value="">공통(거래처 무관)</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div>
          <span className="text-xs font-semibold text-slate-500">브랜드 컬러</span>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {colors.map((c) => (
              <span key={c} className="flex items-center gap-1 rounded-md border border-line py-1 pl-1.5 pr-1 text-[11px] text-slate-500">
                <span className="h-4 w-4 rounded" style={{ background: c }} /> {c}
                <button type="button" onClick={() => setColors((p) => p.filter((x) => x !== c))} className="text-slate-400 hover:text-rose-500"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input type="color" value={picker} onChange={(e) => setPicker(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-line" />
            <button type="button" onClick={addColor} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs text-slate-600 hover:border-brand"><Plus className="h-3.5 w-3.5" /> 색 추가</button>
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">폰트(선택)</span>
          <input value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} placeholder="예: Pretendard" className={inputCls} />
        </label>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button type="button" onClick={save} disabled={pending} className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {pending ? "저장 중…" : "브랜드킷 저장"}
        </button>
      </div>
    </div>
  );
}
