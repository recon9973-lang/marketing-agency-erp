"use client";

import { useEffect, useState } from "react";
import { scanRisk, lawUrl, AD_REVIEW_URL, RISK_DISCLAIMER } from "@/lib/journeymap/risk";
import { formatVolume, JNode, Stage, STAGES, STAGE_META } from "@/lib/journeymap/types";

export function DetailPanel({
  node,
  regionHint,
  mainKeyword,
  advertiser,
  onUpdate,
  onAddChild,
  onDelete,
  onClose,
}: {
  node: JNode;
  regionHint?: string;
  mainKeyword?: string;
  advertiser?: string;
  onUpdate: (id: string, patch: Partial<JNode>) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [keyword, setKeyword] = useState(node.keyword);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draft, setDraft] = useState<{ text: string; riskHits: { line: string; description: string }[] } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => setKeyword(node.keyword), [node.id, node.keyword]);
  useEffect(() => {
    setDraft(null);
    setCopied(false);
  }, [node.id]);

  const generateDraft = async () => {
    setDraftLoading(true);
    setDraft(null);
    try {
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
      const res = await fetch("/api/journeymap/paa/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: node.keyword,
          category: "",
          isLocal: Boolean(regionHint && norm(node.keyword).includes(norm(regionHint))),
          query: mainKeyword || node.keyword,
          advertiser: advertiser || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) setDraft({ text: `⚠️ ${data.error || "원고 생성에 실패했습니다."}`, riskHits: [] });
      else setDraft({ text: data.draft, riskHits: data.riskHits || [] });
    } catch {
      setDraft({
        text: "⚠️ 서버 응답이 도중에 끊겼습니다. 원고 생성이 오래 걸려 시간 제한에 걸렸을 수 있습니다 — 버튼을 다시 눌러 재시도해 주세요.",
        riskHits: [],
      });
    } finally {
      setDraftLoading(false);
    }
  };

  const saveKeyword = () => {
    const v = keyword.trim();
    if (!v || v === node.keyword) return;
    const risk = scanRisk(v);
    onUpdate(node.id, { keyword: v, riskLevel: risk.level, riskReasons: risk.reasons });
  };

  const isKeyword = node.kind === "keyword";

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-bold">노드 상세</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
          ×
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">키워드</label>
          {isKeyword ? (
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onBlur={saveKeyword}
              onKeyDown={(e) => e.key === "Enter" && saveKeyword()}
              className="w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none"
            />
          ) : (
            <p className="font-bold">{node.keyword}</p>
          )}
        </div>

        {isKeyword && node.stage && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              여정 단계 {node.stageOverridden && <span className="text-blue-500">(수동 변경됨)</span>}
              {node.aiCorrected && <span className="text-violet-500"> (AI 보정됨)</span>}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s: Stage) => (
                <button
                  key={s}
                  onClick={() => onUpdate(node.id, { stage: s, stageOverridden: true })}
                  className="rounded-full border px-2.5 py-1 text-xs"
                  style={
                    node.stage === s
                      ? { background: STAGE_META[s].color, color: "#fff", borderColor: STAGE_META[s].color }
                      : {}
                  }
                >
                  {STAGE_META[s].label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">분류 신뢰도 {(node.stageConfidence * 100).toFixed(0)}%</p>
          </div>
        )}

        {isKeyword && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-[11px] text-slate-500">월간 검색량(PC)</p>
              <p className="text-lg font-bold">{formatVolume(node.volumePc)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-[11px] text-slate-500">월간 검색량(모바일)</p>
              <p className="text-lg font-bold">{formatVolume(node.volumeMo)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-[11px] text-slate-500">CPC(모바일 1위)</p>
              <p className="text-lg font-bold">{node.cpc != null ? `${node.cpc.toLocaleString()}원` : "-"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-[11px] text-slate-500">경쟁도</p>
              <p className="text-lg font-bold">{node.competition ?? "-"}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-[11px] text-slate-500">S_intent 점수</p>
              <p className="text-lg font-bold">{node.score}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-[11px] text-slate-500">출처 · 심도</p>
              <p className="font-bold">
                {node.source === "naver_ac"
                  ? "네이버"
                  : node.source === "google_ac"
                  ? "구글"
                  : node.source === "naver_kin"
                  ? "지식iN"
                  : node.source === "naver_rel"
                  ? "연관검색어"
                  : node.source === "seed"
                  ? "시드"
                  : "직접"}{" "}
                · L{node.depth}
              </p>
            </div>
          </div>
        )}

        {isKeyword && node.volumePc == null && node.volumeMo == null && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-500">
            {node.source === "naver_kin"
              ? "ℹ️ 지식iN 질문형 키워드는 검색광고 API에 검색량 데이터가 없어 \"-\"로 표시됩니다."
              : "ℹ️ 아직 검색량을 조회하지 않은 키워드입니다. 지도 상단 \"검색량 다시 조회\" 버튼으로 조회할 수 있습니다. (조회 후에도 검색량이 없으면 0으로 표시됩니다)"}
          </p>
        )}

        {node.riskLevel !== "none" && (
          <div
            className={`rounded-lg border p-3 ${
              node.riskLevel === "red" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
            }`}
          >
            <p className="mb-2 text-xs font-bold">
              {node.riskLevel === "red" ? "🔴 의료법 금지 표현" : "🟡 의료법 주의 표현"}
            </p>
            {node.riskReasons.map((r, i) => (
              <div key={i} className="mb-2 text-xs">
                <p className="font-semibold">
                  &ldquo;{r.matched}&rdquo; — {r.law}
                  {lawUrl(r.law) && (
                    <a href={lawUrl(r.law)!} target="_blank" rel="noreferrer" className="ml-1.5 font-normal text-blue-600 underline">
                      조문 보기 ↗
                    </a>
                  )}
                </p>
                <p className="text-slate-600">{r.description}</p>
                <p className="mt-0.5 text-slate-500">💡 {r.suggestion}</p>
              </div>
            ))}
            <p className="mt-1 border-t pt-1.5 text-[10px] text-slate-400">
              {RISK_DISCLAIMER}{" "}
              <a href={AD_REVIEW_URL} target="_blank" rel="noreferrer" className="text-blue-500 underline">
                의료광고 사전심의 안내 ↗
              </a>
            </p>
          </div>
        )}

        {isKeyword &&
          (() => {
            // 키워드에 지역이 없으면 지역을 붙여 검색 — 전국 결과가 아닌 해당 지역 결과를 보여주기 위함
            const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
            const searchQuery =
              regionHint && !norm(node.keyword).includes(norm(regionHint))
                ? `${regionHint} ${node.keyword}`
                : node.keyword;
            return (
              <div className="mt-2 space-y-1.5 rounded-lg border bg-slate-50 p-3 text-xs text-slate-500">
                {node.source === "naver_kin" && node.sourceUrl && (
                  <p>
                    💬{" "}
                    <a className="text-blue-600 underline" href={node.sourceUrl} target="_blank" rel="noreferrer">
                      지식iN 원본 질문 보기
                    </a>{" "}
                    — 환자가 실제로 올린 질문입니다
                  </p>
                )}
                <p>
                  🔗 실제 검색 결과({searchQuery}):{" "}
                  <a
                    className="text-blue-600 underline"
                    href={`https://search.naver.com/search.naver?query=${encodeURIComponent(searchQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    네이버
                  </a>{" "}
                  ·{" "}
                  <a
                    className="text-blue-600 underline"
                    href={`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    구글
                  </a>
                </p>
              </div>
            );
          })()}
      </div>

      <div className="space-y-2 border-t px-4 py-3">
        {isKeyword && (
          <button
            onClick={generateDraft}
            disabled={draftLoading}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {draftLoading ? "🔄 원고 작성 중… (1~3분)" : "✍️ 이 키워드로 원고 생성"}
          </button>
        )}
        <button
          onClick={() => onAddChild(node.id)}
          className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          + 하위 키워드 추가
        </button>
        {isKeyword && (
          <button
            onClick={() => onDelete(node.id)}
            className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            노드 삭제 (하위 포함)
          </button>
        )}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDraft(null)}>
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="text-sm font-bold">✍️ 원고 초안 — {node.keyword}</h3>
              <button onClick={() => setDraft(null)} className="text-slate-400 hover:text-slate-700">
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {draft.riskHits.length > 0 && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                  <p className="mb-1 font-bold">⚠️ 리스크 재검수: {draft.riskHits.length}건 발견 — 게재 전 수정 필요</p>
                  {draft.riskHits.slice(0, 4).map((h, i) => (
                    <p key={i} className="text-slate-600">
                      &ldquo;{h.line}&rdquo; — {h.description}
                    </p>
                  ))}
                </div>
              )}
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{draft.text}</div>
            </div>
            {!draft.text.startsWith("⚠️") && (
              <div className="flex justify-end gap-2 border-t px-5 py-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(draft.text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  {copied ? "✅ 복사됨" : "📋 원고 복사"}
                </button>
                <button
                  onClick={() => setDraft(null)}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
