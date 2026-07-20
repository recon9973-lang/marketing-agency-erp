"use client";

// GEO 단계1 — 키워드. 메인·서브 시드 → 연관키워드 추출(네이버 실측) → 검색량≥30 선별 → 채택.
// 채택한 키워드가 이후 질문·CEP·여정·콘텐츠 단계로 이어진다.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2, ArrowRight } from "lucide-react";
import { extractGeoKeywords, toggleGeoKeyword, removeGeoKeyword } from "@/server/actions/geo-keywords";
import type { GeoKeywordRow } from "@/server/repositories/geo-keyword";

function fmt(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("ko-KR");
}

export function GeoKeywordPanel({
  clientId,
  clientName,
  rows,
  configured
}: {
  clientId: string;
  clientName: string;
  rows: GeoKeywordRow[];
  configured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [main, setMain] = useState("");
  const [sub, setSub] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const maxVol = Math.max(1, ...rows.map((r) => r.volume ?? 0));
  const selectedCount = rows.filter((r) => r.selected).length;

  function extract() {
    setMsg(null);
    const seeds = [main, ...sub.split(/[,\n]/)].map((s) => s.trim()).filter(Boolean);
    if (seeds.length === 0) {
      setMsg("메인 키워드를 입력하세요.");
      return;
    }
    start(async () => {
      const res = await extractGeoKeywords({ clientId, seeds });
      if (!res.ok) {
        setMsg(res.error || "추출에 실패했습니다.");
        return;
      }
      setMsg(
        res.data?.configured
          ? `연관키워드 ${res.data.added}개 추출(검색량 30 이상만 선별).`
          : "네이버 검색광고 API가 미연결이라 연관어를 가져오지 못했습니다(시드만 저장). 연동 화면에서 NAVER_AD_* 키를 설정하세요."
      );
      router.refresh();
    });
  }

  function toggle(id: string, selected: boolean) {
    setBusyId(id);
    start(async () => {
      await toggleGeoKeyword({ id, selected });
      setBusyId(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    setBusyId(id);
    start(async () => {
      await removeGeoKeyword({ id });
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* 시드 입력 */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">1</span>
          <h3 className="text-base font-bold text-ink">키워드 추출</h3>
          <span
            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
              configured ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {configured ? "실측(네이버 SearchAd)" : "미연결·데모"}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {clientName ? <b className="text-slate-600">{clientName}</b> : "거래처"}의 메인·서브 키워드에서 연관키워드를 추출하고 <b>월 검색량 30 이상</b>만 선별합니다.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">메인 키워드</span>
            <input value={main} onChange={(e) => setMain(e.target.value)} placeholder="예: 강남 임플란트" className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">서브 키워드 (쉼표로 구분)</span>
            <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="예: 임플란트 가격, 앞니 임플란트" className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
          </label>
        </div>
        <button
          type="button"
          onClick={extract}
          disabled={pending}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <Search className="h-4 w-4" /> {pending ? "추출 중…" : "연관키워드 추출"}
        </button>
        {msg && <p className="mt-2 text-xs text-slate-600">{msg}</p>}
      </div>

      {/* 키워드 표 */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">
            연관키워드 <span className="text-slate-400">({rows.length})</span>
          </h3>
          <span className="text-xs text-slate-500">
            채택 <b className="text-emerald-700">{selectedCount}</b>개
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-8 text-center text-sm text-slate-500">
            아직 키워드가 없습니다. 위에서 메인·서브 키워드로 추출하세요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="w-8 py-2" />
                  <th className="py-2 pr-3 font-semibold">키워드</th>
                  <th className="px-2 py-2 font-semibold">구분</th>
                  <th className="px-2 py-2 text-right font-semibold">월 검색량</th>
                  <th className="w-24 px-2 py-2 font-semibold">비중</th>
                  <th className="w-8 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`border-b border-line/60 ${r.selected ? "bg-emerald-50/40" : ""}`}>
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={r.selected}
                        disabled={busyId === r.id}
                        onChange={(e) => toggle(r.id, e.target.checked)}
                        className="h-4 w-4 accent-emerald-600"
                      />
                    </td>
                    <td className="py-2 pr-3 font-medium text-ink">{r.term}</td>
                    <td className="px-2 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${r.source === "SEED" ? "bg-slate-800 text-white" : "bg-surface text-slate-500"}`}>
                        {r.source === "SEED" ? "시드" : "연관"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums text-ink">{fmt(r.volume)}</td>
                    <td className="px-2 py-2">
                      <span className="block h-2 rounded-full bg-surface">
                        <span
                          className="block h-2 rounded-full bg-emerald-500"
                          style={{ width: `${Math.round(((r.volume ?? 0) / maxVol) * 100)}%` }}
                        />
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => remove(r.id)} disabled={busyId === r.id} className="text-slate-300 hover:text-rose-500" aria-label="삭제">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedCount > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs text-emerald-800">
              채택한 <b>{selectedCount}개</b> 키워드로 다음 단계(질문 추출)를 이어서 진행할 수 있습니다.
            </p>
            <a
              href={`/geo?client=${clientId}&tab=questions`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              질문 추출로 <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
