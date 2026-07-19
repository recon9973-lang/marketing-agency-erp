"use client";

// src/components/clients/ExposureTracker.tsx
//
// 월보장 노출 트래커 — 거래처 상세 "월보장" 탭.
// ① 트래커: 월보장 키워드의 채널별 최신 노출 순위(guard-rank 잡 적재분)를 표로.
// ② 등록: 담당 마케터/관리자가 키워드의 월보장 설정(보장여부·목표순위·채널·대상)을 추가/수정.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveGuardKeyword, refreshClientRanks, type SaveGuardKeywordInput } from "@/server/actions/exposure";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";

type Latest = { channel: string; rank: number | null; checkedOn: string };
export type GuardKeyword = {
  id: string;
  keyword: string;
  isGuaranteed: boolean;
  targetRank: number | null;
  guardChannel: string;
  guardTarget: string | null;
  latest: Latest[];
};

const inputCls =
  "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const CHANNELS = [
  { value: "blog", label: "블로그" },
  { value: "web", label: "웹문서" },
  { value: "local", label: "지역(플레이스)" },
];

function channelLabel(v: string): string {
  return CHANNELS.find((c) => c.value === v)?.label ?? v;
}

/** 순위 배지 — 1~3 안정 / 4~10 주의 / 미노출. */
function RankBadge({ rank }: { rank: number | null }) {
  if (rank == null) {
    return (
      <span className="inline-block rounded-md border border-dashed border-line px-2 py-0.5 text-xs font-semibold text-slate-400">
        미노출
      </span>
    );
  }
  const cls =
    rank <= 3
      ? "bg-emerald-50 text-emerald-700"
      : rank <= 10
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-600";
  return <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${cls}`}>{rank}위</span>;
}

type FormState = {
  keywordId?: string;
  keyword: string;
  isGuaranteed: boolean;
  targetRank: string;
  guardChannel: string;
  guardTarget: string;
};

const EMPTY: FormState = { keyword: "", isGuaranteed: true, targetRank: "", guardChannel: "blog", guardTarget: "" };

export function ExposureTracker({
  clientId,
  keywords,
  canManage,
  rankConnected = false,
}: {
  clientId: string;
  keywords: GuardKeyword[];
  canManage: boolean;
  rankConnected?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  const guaranteed = keywords.filter((k) => k.isGuaranteed);
  const others = keywords.filter((k) => !k.isGuaranteed);

  function openNew() {
    setError(null);
    setForm({ ...EMPTY });
  }
  function openEdit(k: GuardKeyword) {
    setError(null);
    setForm({
      keywordId: k.id,
      keyword: k.keyword,
      isGuaranteed: k.isGuaranteed,
      targetRank: k.targetRank != null ? String(k.targetRank) : "",
      guardChannel: k.guardChannel,
      guardTarget: k.guardTarget ?? "",
    });
  }

  function submit() {
    if (!form) return;
    setError(null);
    const payload: SaveGuardKeywordInput = {
      clientId,
      keywordId: form.keywordId,
      keyword: form.keyword,
      isGuaranteed: form.isGuaranteed,
      targetRank: form.targetRank.trim() ? Number(form.targetRank) : null,
      guardChannel: form.guardChannel,
      guardTarget: form.guardTarget.trim() || null,
    };
    start(async () => {
      const res = await saveGuardKeyword(payload);
      if (!res.ok) {
        setError(res.error === "FORBIDDEN" ? "이 거래처를 수정할 권한이 없습니다." : "저장에 실패했습니다.");
        return;
      }
      setForm(null);
      router.refresh();
    });
  }

  function refreshRanks() {
    setRefreshMsg(null);
    start(async () => {
      const res = await refreshClientRanks(clientId);
      if (!res.ok) {
        setRefreshMsg(res.error === "FORBIDDEN" ? "권한이 없습니다." : "순위 조회에 실패했습니다.");
        return;
      }
      setRefreshMsg(`${res.measured}건 순위 갱신 완료`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* 트래커 */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            월보장 노출 트래커 <span className="text-slate-400">({guaranteed.length})</span>
            <ConnectionBadge
              state={rankConnected ? "connected" : "unconnected"}
              hint={rankConnected ? "네이버 검색 실측·매일 감시" : "순위 수집 미연동"}
            />
          </h3>
          <div className="flex items-center gap-1.5">
            {refreshMsg ? <span className="text-xs font-medium text-emerald-600">{refreshMsg}</span> : null}
            {rankConnected && guaranteed.length > 0 ? (
              <button onClick={refreshRanks} disabled={pending} title="네이버 검색에서 지금 순위를 조회해 갱신" className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-brand-strong hover:bg-surface disabled:opacity-50">
                {pending ? "조회 중…" : "지금 순위 확인"}
              </button>
            ) : null}
            {canManage && !form ? (
              <button onClick={openNew} className="rounded-md bg-brand px-3 py-2 text-xs font-semibold text-white">
                + 월보장 키워드
              </button>
            ) : null}
          </div>
        </div>

        {guaranteed.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            등록된 월보장 키워드가 없습니다. 계약상 순위를 보장한 키워드를 등록하면 매일 자동 감시합니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-slate-500">
                  <th className="py-2 pr-3">키워드</th>
                  <th className="py-2 pr-3">채널</th>
                  <th className="py-2 pr-3">목표</th>
                  <th className="py-2 pr-3">최근 노출</th>
                  <th className="py-2 pr-3">측정일</th>
                  {canManage ? <th className="py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {guaranteed.map((k) => {
                  const latestForChannel =
                    k.latest.find((l) => l.channel === k.guardChannel) ?? k.latest[0] ?? null;
                  return (
                    <tr key={k.id} className="border-b border-line/60">
                      <td className="py-2 pr-3 font-semibold text-ink">
                        <span className="mr-1 text-amber-500">🔒</span>
                        {k.keyword}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{channelLabel(k.guardChannel)}</td>
                      <td className="py-2 pr-3 text-slate-600">{k.targetRank != null ? `${k.targetRank}위 이내` : "—"}</td>
                      <td className="py-2 pr-3">
                        {latestForChannel ? <RankBadge rank={latestForChannel.rank} /> : <span className="text-xs text-slate-400">수집 대기</span>}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-400">{latestForChannel?.checkedOn ?? "—"}</td>
                      {canManage ? (
                        <td className="py-2 text-right">
                          <button onClick={() => openEdit(k)} className="text-xs font-semibold text-brand-strong hover:underline">
                            수정
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">
          공식 검색 API 기준 순위(실제 통합검색 화면 순서와 다를 수 있음). 파워링크·플레이스·클립·브랜드콘텐츠 등 광고/비공개 영역은 수동 관리.
        </p>
      </div>

      {/* 등록/수정 폼 */}
      {canManage && form ? (
        <div className="rounded-2xl border border-line bg-white p-4">
          <h4 className="mb-3 text-sm font-bold text-ink">{form.keywordId ? "월보장 키워드 수정" : "월보장 키워드 등록"}</h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">키워드 *</span>
              <input
                value={form.keyword}
                onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                placeholder="예: 수성구 도수치료"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">측정 채널</span>
              <select
                value={form.guardChannel}
                onChange={(e) => setForm({ ...form, guardChannel: e.target.value })}
                className={inputCls}
              >
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">보장 목표순위(위 이내)</span>
              <input
                value={form.targetRank}
                onChange={(e) => setForm({ ...form, targetRank: e.target.value.replace(/[^0-9]/g, "") })}
                inputMode="numeric"
                placeholder="예: 1"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">순위 판정 대상(URL·상호)</span>
              <input
                value={form.guardTarget}
                onChange={(e) => setForm({ ...form, guardTarget: e.target.value })}
                placeholder="비우면 거래처 대표 계정/상호로 판정"
                className={inputCls}
              />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.isGuaranteed}
              onChange={(e) => setForm({ ...form, isGuaranteed: e.target.checked })}
            />
            월보장(순위 보장) 키워드 — 매일 자동 감시·이탈 시 알림
          </label>
          {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "저장 중…" : "저장"}
            </button>
            <button onClick={() => setForm(null)} className="rounded-md border border-line px-4 py-2 text-sm text-slate-600">
              취소
            </button>
          </div>
        </div>
      ) : null}

      {/* 일반 키워드(비월보장) */}
      {others.length > 0 ? (
        <div className="rounded-2xl border border-line bg-card p-4">
          <h3 className="mb-2 text-sm font-bold text-ink">
            일반 키워드 <span className="text-slate-400">({others.length})</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {others.map((k) => (
              <span key={k.id} className="inline-flex items-center gap-2 rounded-md bg-surface px-2.5 py-1 text-xs text-slate-600">
                {k.keyword}
                {canManage ? (
                  <button onClick={() => openEdit(k)} className="text-brand-strong hover:underline">
                    월보장 지정
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
