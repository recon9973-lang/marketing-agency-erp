"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { lookupKeywordsFull } from "@/server/actions/keywords";
import type { KeywordFull } from "@/server/integrations/naver-search";

const numberFormatter = new Intl.NumberFormat("ko-KR");

function fmtInt(value: number | null) {
  return value == null ? "—" : numberFormatter.format(value);
}
function fmtFloat(value: number | null, suffix = "") {
  return value == null ? "—" : `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}${suffix}`;
}
function norm(kw: string) {
  return kw.replace(/\s+/g, "").toLowerCase();
}

/** SpreadsheetML 2003(.xls) — 라이브러리 없이 엑셀이 바로 여는 형식(한글 OK). */
function buildExcel(rows: KeywordFull[]): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const headers = ["구분", "키워드", "PC 검색수", "모바일 검색수", "월간 합계", "PC 월평균클릭", "모바일 월평균클릭", "PC 클릭률(%)", "모바일 클릭률(%)", "월평균 노출광고수", "경쟁정도", "시드"];
  const cell = (v: string | number | null, type: "String" | "Number") => {
    if (v == null || v === "") return `<Cell><Data ss:Type="String"></Data></Cell>`;
    if (type === "Number") return `<Cell><Data ss:Type="Number">${v}</Data></Cell>`;
    return `<Cell><Data ss:Type="String">${esc(String(v))}</Data></Cell>`;
  };
  const headerRow = `<Row>${headers.map((h) => cell(h, "String")).join("")}</Row>`;
  const dataRows = rows
    .map((r) =>
      `<Row>${[
        cell(r.related ? "연관" : "시드", "String"),
        cell(r.keyword, "String"),
        cell(r.pc, "Number"),
        cell(r.mobile, "Number"),
        cell(r.total, "Number"),
        cell(r.pcClicks, "Number"),
        cell(r.mobileClicks, "Number"),
        cell(r.pcCtr, "Number"),
        cell(r.mobileCtr, "Number"),
        cell(r.adDepth, "Number"),
        cell(r.competition, "String"),
        cell(r.seed, "String")
      ].join("")}</Row>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="검색량"><Table>${headerRow}${dataRows}</Table></Worksheet>
</Workbook>`;
}

export function KeywordLookup() {
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<KeywordFull[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const totals = useMemo(() => {
    const seed = rows.filter((r) => !r.related).length;
    return { seed, related: rows.length - seed };
  }, [rows]);

  function run() {
    setError(null);
    setNote(null);
    if (!input.trim()) return;
    start(async () => {
      const res = await lookupKeywordsFull({ keywords: input });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      const incoming = res.data.rows;
      setConnected(res.data.connected);
      if (res.data.truncated > 0) setNote(`연관키워드가 많아 상위 ${incoming.filter((r) => r.related).length}개만 표시했습니다(${res.data.truncated}개 생략).`);
      // 누적 병합: 기존 키워드는 값 갱신, 신규는 추가. 시드였던 키워드는 시드 유지.
      setRows((prev) => {
        const map = new Map(prev.map((r) => [norm(r.keyword), r]));
        for (const r of incoming) {
          const key = norm(r.keyword);
          const existing = map.get(key);
          map.set(key, existing ? { ...r, related: existing.related && r.related } : r);
        }
        return [...map.values()];
      });
    });
  }

  function removeRow(keyword: string) {
    setRows((prev) => prev.filter((r) => norm(r.keyword) !== norm(keyword)));
  }
  function clearAll() {
    setRows([]);
    setNote(null);
  }

  function downloadExcel() {
    if (rows.length === 0) return;
    const xml = buildExcel(rows);
    const blob = new Blob(["﻿" + xml], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `검색량_조회_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const anyEstimated = rows.some((r) => r.estimated);

  return (
    <div className="space-y-4">
      {/* 조회 입력 */}
      <div className="space-y-2 rounded-2xl border border-line bg-white p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          <span>키워드 (쉼표 또는 줄바꿈으로 구분, 최대 5개) · 조회하면 연관키워드까지 자동으로 함께 표시됩니다</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="예: 강남치과, 임플란트 가격, 스케일링"
            className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={run} disabled={pending}>
            <Search className="mr-1 inline h-4 w-4" />
            {pending ? "조회 중…" : rows.length > 0 ? "조회 추가" : "검색량 조회"}
          </Button>
          {rows.length > 0 ? <span className="text-xs text-slate-400">다시 조회하면 결과가 <b>누적</b>됩니다.</span> : null}
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
        {note ? <p className="text-xs text-amber-600">{note}</p> : null}
        {connected === false ? (
          <p className="text-xs text-slate-400">※ 미연동(데모) 상태 — 시드 키워드는 추정치이고 연관키워드는 표시되지 않습니다. 검색광고 API 키를 설정하면 실측·연관키워드가 표시됩니다.</p>
        ) : null}
      </div>

      {/* 결과 툴바 */}
      {rows.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              총 <b className="text-ink">{rows.length}</b>개 · 시드 {totals.seed} · 연관 {totals.related}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={downloadExcel} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50">
                <Download className="h-4 w-4" /> 엑셀 다운로드
              </button>
              <button type="button" onClick={clearAll} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-slate-500 hover:bg-surface">
                전체 삭제
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-line bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface/60 text-left text-xs text-slate-500">
                    <th className="px-3 py-2 font-medium">구분</th>
                    <th className="px-3 py-2 font-medium">키워드</th>
                    <th className="px-3 py-2 text-right font-medium">PC 검색</th>
                    <th className="px-3 py-2 text-right font-medium">모바일 검색</th>
                    <th className="px-3 py-2 text-right font-medium">합계(월)</th>
                    <th className="px-3 py-2 text-right font-medium">PC 클릭</th>
                    <th className="px-3 py-2 text-right font-medium">모바일 클릭</th>
                    <th className="px-3 py-2 text-right font-medium">PC 클릭률</th>
                    <th className="px-3 py-2 text-right font-medium">모바일 클릭률</th>
                    <th className="px-3 py-2 text-right font-medium">노출광고</th>
                    <th className="px-3 py-2 font-medium">경쟁</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.keyword} className="border-b border-line last:border-0">
                      <td className="px-3 py-2">
                        {row.related ? (
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">연관</span>
                        ) : (
                          <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand">시드</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-ink">
                        {row.keyword}
                        {row.estimated ? <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">데모 추정</span> : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fmtInt(row.pc)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fmtInt(row.mobile)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">{fmtInt(row.total)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmtFloat(row.pcClicks)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmtFloat(row.mobileClicks)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmtFloat(row.pcCtr, "%")}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmtFloat(row.mobileCtr, "%")}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmtFloat(row.adDepth)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.competition ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => removeRow(row.keyword)} title="이 행 삭제" className="rounded-md p-1 text-slate-400 hover:bg-danger/10 hover:text-danger">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {anyEstimated ? (
            <p className="text-xs text-slate-400">※ ‘데모 추정’은 실제 검색량이 아닙니다. 네이버 검색광고 API 키를 설정하면 실제 월간 검색수로 바뀝니다.</p>
          ) : null}
        </>
      ) : (
        <p className="rounded-md border border-dashed border-line bg-surface/40 px-4 py-6 text-center text-sm text-slate-400">
          키워드를 입력해 조회하면 네이버가 제공하는 전체 지표와 연관키워드가 여기에 누적됩니다.
        </p>
      )}
    </div>
  );
}
