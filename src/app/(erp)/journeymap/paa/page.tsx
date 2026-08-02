"use client";

// PAA(환자 질문) 분석 홈 — 분석 실행·조합 추천·스냅샷 관리·비교 선택 (journeymap 단독판 이식)

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AnalyzeResponse, PaaDiff, SnapshotSummary } from "@/lib/journeymap/paa";

const STALE_DAYS = 30;

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function PaaPage() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [advertiser, setAdvertiser] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ query: string; diff: PaaDiff } | null>(null);
  const [pendingSnapshotId, setPendingSnapshotId] = useState<string | null>(null);
  const [combos, setCombos] = useState<{ query: string; score: number }[] | null>(null);
  const [compareSel, setCompareSel] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const loadSnapshots = useCallback(async () => {
    try {
      const res = await fetch("/api/journeymap/paa/snapshots");
      const data = await res.json();
      setSnapshots(data.snapshots || []);
    } catch {
      // 목록 로드 실패는 치명적이지 않음
    }
  }, []);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const analyze = useCallback(
    async (q: string, adv: string, refresh: boolean) => {
      setError(null);
      setDiff(null);
      setLoading(refresh ? `"${q}" 새로 수집·분석 중… (10~30초)` : `"${q}" 분석 중… (10~30초)`);
      try {
        const res = await fetch("/api/journeymap/paa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q, advertiser: adv, refresh }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "분석에 실패했습니다.");
          return;
        }
        const result = data as AnalyzeResponse;
        await loadSnapshots();
        if (result.diff && (result.diff.added.length > 0 || result.diff.removed.length > 0)) {
          setDiff({ query: result.query, diff: result.diff });
          setPendingSnapshotId(result.snapshotId);
        } else {
          router.push(`/journeymap/paa/${result.snapshotId}`);
        }
      } catch {
        setError("서버 요청에 실패했습니다. 잠시 후 다시 시도하세요.");
      } finally {
        setLoading(null);
      }
    },
    [loadSnapshots, router]
  );

  const recommendCombos = useCallback(async (q: string) => {
    setError(null);
    setCombos(null);
    setLoading("지역 조합 검색 추이 조회 중…");
    try {
      const res = await fetch("/api/journeymap/paa/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "조합 추천에 실패했습니다.");
      else setCombos(data.combos);
    } catch {
      setError("서버 요청에 실패했습니다.");
    } finally {
      setLoading(null);
    }
  }, []);

  const deleteSnapshot = useCallback(
    async (s: SnapshotSummary) => {
      if (!confirm(`"${s.query}" ${new Date(s.createdAt).toLocaleDateString("ko-KR")} 스냅샷을 삭제할까요?\n삭제하면 되돌릴 수 없습니다.`)) return;
      await fetch(`/api/journeymap/paa/snapshots/${s.id}`, { method: "DELETE" });
      await loadSnapshots();
    },
    [loadSnapshots]
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">💬 환자 질문 분석 (PAA)</h1>
          <p className="text-sm text-slate-500">
            지식iN 실제 질문 수집 → AI 분류 → 검색여정 질문 지도. 스냅샷은 삭제 전까지 영구 보관됩니다.
          </p>
        </div>
        <Link href="/journeymap" className="text-sm text-slate-500 hover:text-slate-900">
          ← 여정맵 홈
        </Link>
      </div>

      {/* 분석 입력 */}
      <div className="mb-8 rounded-2xl border bg-white p-6 shadow-sm">
        <p className="mb-3 text-sm font-bold text-slate-600">새 분석</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim() && !loading) analyze(query, advertiser, false);
            }}
            placeholder="키워드 (예: 대구 임플란트)"
            className="w-72 rounded-lg border px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
          />
          <input
            value={advertiser}
            onChange={(e) => setAdvertiser(e.target.value)}
            placeholder="광고주 병원명 (선택)"
            className="w-56 rounded-lg border px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => analyze(query, advertiser, false)}
            disabled={!query.trim() || !!loading}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            질문 지도 만들기
          </button>
          <button
            onClick={() => recommendCombos(query)}
            disabled={!query.trim() || !!loading}
            className="rounded-lg border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-40"
            title="지역·시술 조합별 네이버 검색 추이를 비교해 우선순위를 추천합니다"
          >
            📈 지역 조합 추천
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          같은 키워드는 저장된 최신 결과를 즉시 불러옵니다(비용 0원). 새 데이터가 필요하면 아래 목록에서 &ldquo;다시
          분석&rdquo;을 누르세요.
        </p>
        {combos && (
          <div className="mt-4 max-w-xl rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <p className="mb-2 text-xs font-bold text-slate-600">
              검색 추이 기준 우선순위 (최근 6개월 상대값) — 클릭하면 키워드로 입력됩니다
            </p>
            {combos.map((c) => {
              const max = Math.max(...combos.map((x) => x.score), 1);
              return (
                <button
                  key={c.query}
                  onClick={() => {
                    setQuery(c.query);
                    setCombos(null);
                  }}
                  className="group flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-blue-100/60"
                >
                  <span className="w-40 truncate text-xs font-semibold text-slate-700">{c.query}</span>
                  <span className="relative h-3.5 flex-1 overflow-hidden rounded bg-white">
                    <span
                      className="absolute inset-y-0 left-0 rounded-r bg-blue-500 group-hover:bg-blue-600"
                      style={{ width: `${(c.score / max) * 100}%` }}
                    />
                  </span>
                  <span className="w-12 text-right text-xs tabular-nums text-slate-500">{c.score}</span>
                </button>
              );
            })}
          </div>
        )}
        {loading && <p className="mt-3 text-sm font-semibold text-blue-600">🔄 {loading}</p>}
        {error && <p className="mt-3 text-sm font-semibold text-red-600">⚠️ {error}</p>}
      </div>

      {/* 재분석 diff */}
      {diff && (
        <div className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm">
          <p className="mb-2 font-bold text-emerald-800">📊 &ldquo;{diff.query}&rdquo; — 직전 스냅샷과 비교</p>
          {diff.diff.added.length > 0 && (
            <div className="mb-2">
              <p className="font-semibold text-emerald-700">🆕 새로 등장한 질문 {diff.diff.added.length}건</p>
              <ul className="ml-4 list-disc text-emerald-900">
                {diff.diff.added.slice(0, 8).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {diff.diff.removed.length > 0 && (
            <div>
              <p className="font-semibold text-slate-500">➖ 사라진 질문 {diff.diff.removed.length}건</p>
              <ul className="ml-4 list-disc text-slate-500">
                {diff.diff.removed.slice(0, 5).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {pendingSnapshotId && (
            <button
              onClick={() => router.push(`/journeymap/paa/${pendingSnapshotId}`)}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              새 질문 지도 열기 →
            </button>
          )}
        </div>
      )}

      {/* 스냅샷 목록 */}
      <div className="mb-3 flex items-center gap-3">
        <p className="text-sm font-bold text-slate-600">저장된 스냅샷 {mounted ? snapshots.length : ""}개</p>
        <span className="text-xs text-slate-400">— 체크박스로 2개를 고르면 비교할 수 있습니다 (시점·지역 비교)</span>
        {compareSel.length === 2 && (
          <button
            onClick={() => router.push(`/journeymap/paa/compare?a=${compareSel[0]}&b=${compareSel[1]}`)}
            className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
          >
            ⚖️ 선택한 2개 비교
          </button>
        )}
      </div>
      {!mounted ? null : snapshots.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed bg-white p-12 text-center text-sm text-slate-500">
          아직 저장된 분석이 없습니다. 위에서 키워드를 입력해 첫 질문 지도를 만들어보세요.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="w-8 px-3 py-2.5"></th>
                <th className="px-4 py-2.5">키워드</th>
                <th className="px-4 py-2.5">지역 / 주제</th>
                <th className="px-4 py-2.5">광고주</th>
                <th className="px-4 py-2.5">질문 수</th>
                <th className="px-4 py-2.5">수집 시점</th>
                <th className="px-4 py-2.5 text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => {
                const age = daysAgo(s.createdAt);
                return (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={compareSel.includes(s.id)}
                        onChange={(e) =>
                          setCompareSel((prev) =>
                            e.target.checked ? [...prev, s.id].slice(-2) : prev.filter((x) => x !== s.id)
                          )
                        }
                        title="비교 대상으로 선택"
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold">{s.query}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.region && (
                        <span className="mr-1 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">
                          📍 {s.region}
                        </span>
                      )}
                      {s.topic && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{s.topic}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.advertiser || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{s.rawCount}개</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(s.createdAt).toLocaleDateString("ko-KR")}
                      {age >= STALE_DAYS && (
                        <span
                          className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700"
                          title={`${age}일 경과 — 다시 분석을 권장합니다`}
                        >
                          {age}일 경과
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => router.push(`/journeymap/paa/${s.id}`)}
                        disabled={!!loading}
                        className="mr-1.5 rounded border px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                      >
                        보기
                      </button>
                      <button
                        onClick={() => analyze(s.query, s.advertiser || "", true)}
                        disabled={!!loading}
                        className="mr-1.5 rounded border px-2.5 py-1 text-xs hover:bg-slate-100 disabled:opacity-40"
                        title="캐시를 무시하고 새로 수집합니다 (API 비용 발생, 기존 스냅샷은 보존)"
                      >
                        다시 분석
                      </button>
                      <button
                        onClick={() => deleteSnapshot(s)}
                        disabled={!!loading}
                        className="rounded border px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-40"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">
        &ldquo;다시 분석&rdquo;은 기존 스냅샷을 지우지 않고 새 스냅샷을 추가하며, 직전 결과와의 차이(새 질문/사라진
        질문)를 자동으로 보여줍니다.
      </p>
    </div>
  );
}
