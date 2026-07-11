"use client";

import { useState, useTransition } from "react";
import {
  researchKeyword,
  generateBlogDraft,
  collectReportPerformance,
  assembleReport
} from "@/server/actions/marketing";

type Client = { id: string; name: string };
type Panel = "research" | "content" | "performance" | "report";

const cardCls = "rounded-lg border border-line bg-white p-5";
const labelCls = "mb-1 block text-xs font-medium text-slate-600";
const inputCls = "w-full rounded-md border border-line px-3 py-2 text-sm";
const btnCls = "rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

function ResultView({ data }: { data: unknown }) {
  if (data == null) return null;
  return (
    <pre className="mt-3 max-h-64 overflow-auto rounded-md border border-line bg-surface p-3 text-xs leading-5 text-slate-700">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function StudioClient({ clients }: { clients: Client[] }) {
  const [pending, start] = useTransition();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [out, setOut] = useState<Record<Panel, unknown>>({
    research: null,
    content: null,
    performance: null,
    report: null
  });
  const set = (k: Panel, v: unknown) => setOut((o) => ({ ...o, [k]: v }));

  const [seed, setSeed] = useState("");
  const [keyword, setKeyword] = useState("");
  const [medical, setMedical] = useState(true);
  const [reportId, setReportId] = useState("");
  const [perfKeywords, setPerfKeywords] = useState("");
  const [target, setTarget] = useState("");

  const clientPicker = (
    <div>
      <label className={labelCls}>거래처</label>
      <select className={inputCls} value={clientId} onChange={(e) => setClientId(e.target.value)}>
        {clients.length === 0 && <option value="">배정된 거래처 없음</option>}
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* ① 리서치 */}
      <div className={cardCls}>
        <h3 className="text-sm font-semibold text-ink">① 키워드 리서치</h3>
        <p className="mt-1 text-xs text-slate-500">네이버 DataLab·검색으로 트렌드·경쟁강도 수집</p>
        <div className="mt-3 space-y-3">
          {clientPicker}
          <div>
            <label className={labelCls}>시드 키워드</label>
            <input
              className={inputCls}
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="예: 강남 임플란트"
            />
          </div>
          <button
            className={btnCls}
            disabled={pending || !clientId || !seed}
            onClick={() => start(async () => set("research", await researchKeyword({ clientId, seedKeyword: seed })))}
          >
            리서치 실행
          </button>
          <ResultView data={out.research} />
        </div>
      </div>

      {/* ② 콘텐츠 + 검수 */}
      <div className={cardCls}>
        <h3 className="text-sm font-semibold text-ink">② SEO 초안 + 의료광고법 검수</h3>
        <p className="mt-1 text-xs text-slate-500">seo-generator 초안 → 컴플라이언스 게이트</p>
        <div className="mt-3 space-y-3">
          {clientPicker}
          <div>
            <label className={labelCls}>키워드</label>
            <input
              className={inputCls}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="예: 임플란트 관리법"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={medical} onChange={(e) => setMedical(e.target.checked)} />
            의료·건강 주제(의료광고법 검수 적용)
          </label>
          <button
            className={btnCls}
            disabled={pending || !clientId || !keyword}
            onClick={() => start(async () => set("content", await generateBlogDraft({ clientId, keyword, medical })))}
          >
            초안 생성
          </button>
          <ResultView data={out.content} />
        </div>
      </div>

      {/* ③ 성과수집 */}
      <div className={cardCls}>
        <h3 className="text-sm font-semibold text-ink">③ 성과수집 → 보고서</h3>
        <p className="mt-1 text-xs text-slate-500">키워드 노출순위를 Report.metrics에 적재</p>
        <div className="mt-3 space-y-3">
          <div>
            <label className={labelCls}>보고서 ID</label>
            <input
              className={inputCls}
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
              placeholder="report cuid"
            />
          </div>
          <div>
            <label className={labelCls}>키워드(쉼표 구분)</label>
            <input
              className={inputCls}
              value={perfKeywords}
              onChange={(e) => setPerfKeywords(e.target.value)}
              placeholder="강남 임플란트, 임플란트 가격"
            />
          </div>
          <div>
            <label className={labelCls}>대상(도메인/플레이스)</label>
            <input
              className={inputCls}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="myclinic.co.kr"
            />
          </div>
          <button
            className={btnCls}
            disabled={pending || !reportId || !perfKeywords || !target}
            onClick={() =>
              start(async () =>
                set(
                  "performance",
                  await collectReportPerformance({
                    reportId,
                    keywords: perfKeywords
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    target
                  })
                )
              )
            }
          >
            성과 수집
          </button>
          <ResultView data={out.performance} />
        </div>
      </div>

      {/* ④ 리포트 조립 */}
      <div className={cardCls}>
        <h3 className="text-sm font-semibold text-ink">④ 월간 리포트 자동조립</h3>
        <p className="mt-1 text-xs text-slate-500">순위 집계 + 요약 코멘트 자동 생성(→ Report.metrics.summary)</p>
        <div className="mt-3 space-y-3">
          <div>
            <label className={labelCls}>보고서 ID</label>
            <input
              className={inputCls}
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
              placeholder="report cuid"
            />
          </div>
          <button
            className={btnCls}
            disabled={pending || !reportId}
            onClick={() => start(async () => set("report", await assembleReport({ reportId })))}
          >
            리포트 조립
          </button>
          <ResultView data={out.report} />
        </div>
      </div>
    </div>
  );
}
