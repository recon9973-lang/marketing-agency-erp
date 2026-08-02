"use client";

// C15·C16: 스냅샷 비교 — 같은 키워드 두 시점(시점 비교) 또는 다른 지역·같은 시술(지역 비교)

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { PaaTree } from "@/lib/journeymap/paa";
import { Stage, STAGE_META } from "@/lib/journeymap/types";

interface SnapshotDetail {
  snapshotId: string;
  createdAt: string;
  query: string;
  region: string | null;
  topic: string | null;
  advertiser: string | null;
  rawCount: number;
  tree: PaaTree;
}

interface QInfo {
  text: string;
  category: string;
  stage: Stage;
  isLocal: boolean;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s?.!~,]/g, "");
}

function questionMap(tree: PaaTree): Map<string, QInfo> {
  const m = new Map<string, QInfo>();
  for (const c of tree.categories) {
    for (const q of c.questions) {
      m.set(norm(q.text), { text: q.text.trim(), category: c.name, stage: c.stage, isLocal: q.isLocal });
    }
  }
  return m;
}

function QuestionList({ items, accent }: { items: QInfo[]; accent: string }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-xs text-slate-400">해당 질문이 없습니다</p>;
  }
  return (
    <ul className="space-y-1.5">
      {items.map((q) => (
        <li key={q.text} className="rounded-lg border bg-white px-3 py-2 text-[13px]" style={{ borderLeftWidth: 3, borderLeftColor: accent }}>
          <p className="text-slate-800">{q.text}</p>
          <p className="mt-0.5 flex gap-2 text-[10px] text-slate-400">
            <span style={{ color: STAGE_META[q.stage].color }}>{STAGE_META[q.stage].label}</span>
            <span>{q.category}</span>
            {q.isLocal && <span className="text-emerald-600">📍 지역</span>}
          </p>
        </li>
      ))}
    </ul>
  );
}

function SnapBadge({ snap, color }: { snap: SnapshotDetail; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold text-white" style={{ background: color }}>
      {snap.query}
      <span className="text-xs font-normal opacity-80">{new Date(snap.createdAt).toLocaleDateString("ko-KR")}</span>
    </span>
  );
}

function CompareInner() {
  const sp = useSearchParams();
  const idA = sp.get("a");
  const idB = sp.get("b");
  const [a, setA] = useState<SnapshotDetail | null>(null);
  const [b, setB] = useState<SnapshotDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idA || !idB) {
      setError("비교할 스냅샷 2개를 선택하세요.");
      return;
    }
    (async () => {
      try {
        const [ra, rb] = await Promise.all([
          fetch(`/api/journeymap/paa/snapshots/${idA}`),
          fetch(`/api/journeymap/paa/snapshots/${idB}`),
        ]);
        const [da, db] = await Promise.all([ra.json(), rb.json()]);
        if (!ra.ok) return setError(da.error || "스냅샷 A를 불러올 수 없습니다.");
        if (!rb.ok) return setError(db.error || "스냅샷 B를 불러올 수 없습니다.");
        setA(da);
        setB(db);
      } catch {
        setError("서버 요청에 실패했습니다.");
      }
    })();
  }, [idA, idB]);

  const result = useMemo(() => {
    if (!a || !b) return null;
    const mapA = questionMap(a.tree);
    const mapB = questionMap(b.tree);
    const common: QInfo[] = [];
    const onlyA: QInfo[] = [];
    const onlyB: QInfo[] = [];
    mapA.forEach((v, k) => (mapB.has(k) ? common : onlyA).push(v));
    mapB.forEach((v, k) => {
      if (!mapA.has(k)) onlyB.push(v);
    });
    const mode =
      a.query === b.query ? "시점 비교" : a.topic && a.topic === b.topic ? "지역 비교" : "자유 비교";
    return { common, onlyA, onlyB, mode };
  }, [a, b]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-600">⚠️ {error}</p>
        <Link href="/journeymap/paa" className="text-sm text-blue-600 underline">← 목록으로</Link>
      </div>
    );
  }
  if (!a || !b || !result) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">불러오는 중…</div>;
  }

  const total = result.common.length + result.onlyA.length + result.onlyB.length;
  const overlapPct = total > 0 ? Math.round((result.common.length / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex flex-wrap items-center gap-3 border-b bg-white px-5 py-3">
        <Link href="/journeymap/paa" className="text-sm text-slate-500 hover:text-slate-900">← 목록</Link>
        <h1 className="font-bold">스냅샷 비교</h1>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {result.mode}
        </span>
        <div className="ml-2 flex items-center gap-2">
          <SnapBadge snap={a} color="#2a78d6" />
          <span className="text-slate-400">vs</span>
          <SnapBadge snap={b} color="#eb6834" />
        </div>
      </header>

      {/* 비교 요약 */}
      <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
        {[
          // 잉크색은 slate 클래스로 — ERP 전역 다크 브리지가 자동 반전 (액센트만 인라인)
          { label: "A에만 있는 질문", value: result.onlyA.length, color: "#2a78d6" },
          { label: "공통 질문", value: result.common.length, color: null },
          { label: "B에만 있는 질문", value: result.onlyB.length, color: "#eb6834" },
          { label: "질문 겹침율", value: `${overlapPct}%`, color: null },
        ].map((t) => (
          <div key={t.label} className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-400">{t.label}</p>
            <p
              className="mt-1 text-2xl font-bold text-slate-900"
              style={t.color ? { color: t.color } : undefined}
            >
              {t.value}
            </p>
          </div>
        ))}
      </div>

      {result.mode === "지역 비교" && result.onlyA.length > 0 && (
        <p className="mx-4 mb-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          💡 <b>선점 기회</b>: &ldquo;{a.query}&rdquo;에서는 나오는데 &ldquo;{b.query}&rdquo;에는 아직 없는 질문{" "}
          {result.onlyA.length}건 — {b.region || "B 지역"}에서 이 질문에 첫 번째로 답하는 콘텐츠를 만들 수 있습니다. (반대 방향은 B에만 목록 참고)
        </p>
      )}

      {/* 3단 목록 */}
      <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
        <section>
          <h2 className="mb-2 text-sm font-bold" style={{ color: "#2a78d6" }}>
            A에만 — {a.query} ({result.onlyA.length})
          </h2>
          <QuestionList items={result.onlyA} accent="#2a78d6" />
        </section>
        <section>
          <h2 className="mb-2 text-sm font-bold text-slate-500">공통 ({result.common.length})</h2>
          <QuestionList items={result.common} accent="#c3c2b7" />
        </section>
        <section>
          <h2 className="mb-2 text-sm font-bold" style={{ color: "#eb6834" }}>
            B에만 — {b.query} ({result.onlyB.length})
          </h2>
          <QuestionList items={result.onlyB} accent="#eb6834" />
        </section>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-400">불러오는 중…</div>}>
      <CompareInner />
    </Suspense>
  );
}
