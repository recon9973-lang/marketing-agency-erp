"use client";

// 교집합·갭 분석 시각화 (진단 탭 확장)
// - 벤 다이어그램: 3개 수집 소스(네이버·구글·연관)의 키워드 교집합
// - 업셋 플롯: 지식iN 포함 4세트 교집합 크기 (세트 4개 이상은 UpSet이 표준)
// - 여정 × 질문심리 매트릭스
// - 키워드 갭: 자사 브랜드 / 경쟁 브랜드 / 공통 일반 수요
// 색상 3종(#059669/#2563eb/#d97706)은 CVD 검증 통과(ΔE 24.9+), 텍스트는 잉크 토큰 사용

import { useMemo } from "react";
import { classifyPsych, PSYCH_CODES, PSYCH_META, PsychCode } from "@/lib/journeymap/qpc";
import { formatVolume, HospitalProfile, JNode, Source, STAGE_META, STAGES, Stage } from "@/lib/journeymap/types";

const SET_DEFS: { key: Source; label: string; color: string }[] = [
  { key: "naver_ac", label: "네이버 자동완성", color: "#059669" },
  { key: "google_ac", label: "구글 자동완성", color: "#2563eb" },
  { key: "naver_rel", label: "검색광고 연관", color: "#d97706" },
];
const KIN_SET: { key: Source; label: string; color: string } = {
  key: "naver_kin",
  label: "지식iN 질문",
  color: "#7c3aed",
};

function memberships(n: JNode): Source[] {
  return n.sourcesAll && n.sourcesAll.length > 0 ? n.sourcesAll : [n.source];
}

// ── 벤 다이어그램 (3세트) ─────────────────────────────────────────
export function SourceVenn({ nodes }: { nodes: JNode[] }) {
  const kw = nodes.filter((n) => n.kind === "keyword");
  const has = (n: JNode, s: Source) => memberships(n).includes(s);
  const [A, B, C] = SET_DEFS.map((d) => d.key);
  const count = (a: boolean, b: boolean, c: boolean) =>
    kw.filter((n) => has(n, A) === a && has(n, B) === b && has(n, C) === c).length;
  const regions = {
    a: count(true, false, false),
    b: count(false, true, false),
    c: count(false, false, true),
    ab: count(true, true, false),
    ac: count(true, false, true),
    bc: count(false, true, true),
    abc: count(true, true, true),
  };
  const totals = SET_DEFS.map((d) => kw.filter((n) => has(n, d.key)).length);
  const anyOverlap = regions.ab + regions.ac + regions.bc + regions.abc > 0;

  return (
    <div>
      <svg viewBox="0 0 300 240" className="mx-auto w-full max-w-sm" role="img" aria-label="수집 소스 벤 다이어그램">
        <circle cx="110" cy="90" r="72" fill={SET_DEFS[0].color} fillOpacity="0.14" stroke={SET_DEFS[0].color} strokeWidth="2" />
        <circle cx="190" cy="90" r="72" fill={SET_DEFS[1].color} fillOpacity="0.14" stroke={SET_DEFS[1].color} strokeWidth="2" />
        <circle cx="150" cy="155" r="72" fill={SET_DEFS[2].color} fillOpacity="0.14" stroke={SET_DEFS[2].color} strokeWidth="2" />
        {[
          { x: 78, y: 72, v: regions.a },
          { x: 222, y: 72, v: regions.b },
          { x: 150, y: 200, v: regions.c },
          { x: 150, y: 66, v: regions.ab },
          { x: 103, y: 140, v: regions.ac },
          { x: 197, y: 140, v: regions.bc },
          { x: 150, y: 118, v: regions.abc },
        ].map((r, i) => (
          <text key={i} x={r.x} y={r.y} textAnchor="middle" className="fill-slate-700" fontSize="14" fontWeight={600}>
            {r.v}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap justify-center gap-3 text-xs text-slate-600">
        {SET_DEFS.map((d, i) => (
          <span key={d.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            {d.label} {totals[i]}개
          </span>
        ))}
      </div>
      {!anyOverlap && (
        <p className="mt-2 text-center text-[11px] text-amber-600">
          ⚠️ 교집합 0 — 이 맵은 다중 소스 기록 기능(오늘 배포) 이전에 수집됐습니다. 새로 생성하면 교집합이 채워집니다.
        </p>
      )}
      <p className="mt-1 text-center text-[11px] text-slate-400">
        여러 소스가 동시에 발견한 키워드일수록 수요가 검증된 키워드입니다.
      </p>
    </div>
  );
}

// ── 업셋 플롯 (4세트) ─────────────────────────────────────────────
export function SourceUpset({ nodes }: { nodes: JNode[] }) {
  const kw = nodes.filter((n) => n.kind === "keyword");
  const sets = [...SET_DEFS, KIN_SET];
  const combos = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of kw) {
      const m = memberships(n).filter((s) => sets.some((d) => d.key === s));
      if (m.length === 0) continue;
      const key = sets
        .map((d) => d.key)
        .filter((s) => m.includes(s))
        .join("|");
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([key, count]) => ({ members: key.split("|") as Source[], count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  if (combos.length === 0) return null;
  const maxCount = Math.max(...combos.map((c) => c.count), 1);
  const colW = 40;
  const left = 128;
  const barMaxH = 72;
  const matrixTop = 100;
  const rowH = 22;
  const width = left + combos.length * colW + 8;
  const height = matrixTop + sets.length * rowH + 8;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="소스 교집합 업셋 플롯">
        {combos.map((c, i) => {
          const h = Math.max(3, (c.count / maxCount) * barMaxH);
          const x = left + i * colW + colW / 2;
          return (
            <g key={i}>
              <rect x={x - 9} y={92 - h} width={18} height={h} rx={3} className="fill-slate-500" />
              <text x={x} y={92 - h - 5} textAnchor="middle" fontSize="11" fontWeight={600} className="fill-slate-700">
                {c.count}
              </text>
            </g>
          );
        })}
        {sets.map((d, r) => (
          <g key={d.key}>
            <text x={left - 10} y={matrixTop + r * rowH + 5} textAnchor="end" fontSize="11" className="fill-slate-600">
              {d.label}
            </text>
            {combos.map((c, i) => {
              const x = left + i * colW + colW / 2;
              const active = c.members.includes(d.key);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={matrixTop + r * rowH}
                  r={5.5}
                  fill={active ? d.color : "#e2e8f0"}
                />
              );
            })}
          </g>
        ))}
        {combos.map((c, i) => {
          const rows = sets.map((d, r) => ({ r, on: c.members.includes(d.key) })).filter((x) => x.on);
          if (rows.length < 2) return null;
          const x = left + i * colW + colW / 2;
          return (
            <line
              key={i}
              x1={x}
              y1={matrixTop + rows[0].r * rowH}
              x2={x}
              y2={matrixTop + rows[rows.length - 1].r * rowH}
              stroke="#94a3b8"
              strokeWidth={2}
            />
          );
        })}
      </svg>
      <p className="mt-1 text-[11px] text-slate-400">
        각 막대는 &ldquo;정확히 그 소스 조합&rdquo;으로만 발견된 키워드 수 — 점이 여러 개 연결된 조합일수록 교차 검증된
        수요입니다.
      </p>
    </div>
  );
}

// ── 여정 × 질문심리 매트릭스 ─────────────────────────────────────
export function StagePsychMatrix({ nodes }: { nodes: JNode[] }) {
  const questions = nodes.filter((n) => n.kind === "keyword" && n.source === "naver_kin");
  const cells = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of questions) {
      const p = classifyPsych(q.keyword).primary;
      if (!p || !q.stage) continue;
      const key = `${q.stage}:${p}`;
      m.set(key, (m.get(key) || 0) + 1);
    }
    return m;
  }, [questions]);
  const max = Math.max(...Array.from(cells.values()), 1);
  if (cells.size === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center text-xs">
        <thead>
          <tr>
            <th className="p-1.5 text-left text-slate-500">여정 ＼ 심리</th>
            {PSYCH_CODES.map((c) => (
              <th key={c} className="p-1.5 font-semibold" style={{ color: PSYCH_META[c].color }}>
                {PSYCH_META[c].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STAGES.map((s: Stage) => (
            <tr key={s}>
              <td className="p-1.5 text-left font-semibold" style={{ color: STAGE_META[s].color }}>
                {STAGE_META[s].label}
              </td>
              {PSYCH_CODES.map((c: PsychCode) => {
                const v = cells.get(`${s}:${c}`) || 0;
                return (
                  <td key={c} className="p-1">
                    <div
                      className="mx-auto flex h-8 w-full min-w-10 items-center justify-center rounded"
                      style={{ background: v > 0 ? `rgba(37, 99, 235, ${0.12 + 0.55 * (v / max)})` : "#f8fafc" }}
                    >
                      <span className={v > 0 ? "font-semibold text-slate-800" : "text-slate-300"}>{v || ""}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[11px] text-slate-400">
        진한 칸 = 질문이 몰린 &ldquo;여정 단계 × 심리&rdquo; 조합 — 그 조합을 겨냥한 콘텐츠가 최우선입니다.
      </p>
    </div>
  );
}

// ── 키워드 갭 (자사 vs 경쟁 브랜드 수요) ─────────────────────────
export function KeywordGap({ nodes, profile }: { nodes: JNode[]; profile: HospitalProfile }) {
  const kw = nodes.filter((n) => n.kind === "keyword");
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const compNorms = profile.competitors.filter(Boolean).map((c) => ({ name: c, key: norm(c) }));

  const mine = kw.filter((n) => n.isBrand);
  const theirs = kw.filter((n) => compNorms.some((c) => norm(n.keyword).includes(c.key)));
  const generic = kw
    .filter((n) => !n.isBrand && !compNorms.some((c) => norm(n.keyword).includes(c.key)) && n.riskLevel === "none")
    .sort((a, b) => (b.volumePc ?? 0) + (b.volumeMo ?? 0) - ((a.volumePc ?? 0) + (a.volumeMo ?? 0)))
    .slice(0, 8);

  const col = (title: string, color: string, items: JNode[], empty: string) => (
    <div className="rounded-lg border p-3">
      <p className="mb-2 text-xs font-bold" style={{ color }}>
        {title} <span className="font-normal text-slate-400">({items.length}개)</span>
      </p>
      {items.length === 0 ? (
        <p className="text-[11px] text-slate-400">{empty}</p>
      ) : (
        <ul className="space-y-1 text-xs text-slate-600">
          {items.slice(0, 8).map((n) => (
            <li key={n.id} className="flex justify-between gap-2">
              <span className="truncate">{n.keyword}</span>
              <span className="shrink-0 text-slate-400">
                {formatVolume((n.volumePc ?? 0) + (n.volumeMo ?? 0) || null)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {col("① 자사 브랜드 수요", "#059669", mine, "자사 병원명이 포함된 검색 키워드가 아직 없습니다 — 브랜드 인지도 구간.")}
        {col(
          "② 경쟁 브랜드 수요",
          "#dc2626",
          theirs,
          profile.competitors.length === 0
            ? "프로필에 경쟁 병원을 입력하면 비교됩니다."
            : "경쟁 병원명이 포함된 키워드가 수집되지 않았습니다."
        )}
        {col("③ 공통 일반 수요 (기회)", "#2563eb", generic, "검색량 데이터가 있는 일반 키워드가 없습니다.")}
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        ①이 ②보다 작으면 브랜드 인지도 열세 — ③의 고검색량 일반 키워드부터 선점하는 전략이 유효합니다. (검색결과
        순위 기반 정밀 갭 분석은 서치콘솔 연동 시 제공 예정)
      </p>
    </div>
  );
}
