"use client";

// 업무 보고(작업 결과물) — 담당자가 당일 결과물 링크를 남기고, 팀이 거래처별로 열람. (카카오톡 대체)
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ExternalLink, Link2, CalendarDays, X, ClipboardList } from "lucide-react";
import { createWorkReports, deleteWorkReport } from "@/server/actions/work-report";
import type { WorkReportRow, WorkItemOption } from "@/server/repositories/work-report";

const inputCls = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand";

type Draft = { title: string; link: string; note: string };
const emptyDraft = (): Draft => ({ title: "", link: "", note: "" });

export function WorkReportBoard({
  reports,
  clients,
  categories,
  workItems,
  todayISO,
  viewerId,
  isManager
}: {
  reports: WorkReportRow[];
  clients: { id: string; name: string }[];
  categories: string[];
  workItems: WorkItemOption[];
  todayISO: string;
  viewerId: string;
  isManager: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // 작성 폼 — 여러 건을 한 번에(같은 거래처·일자·종류·연결업무 공유)
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [workDate, setWorkDate] = useState(todayISO);
  const [category, setCategory] = useState(categories[0] ?? "기타");
  const [workItemId, setWorkItemId] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([emptyDraft()]);
  const [error, setError] = useState<string | null>(null);

  // 선택 거래처의 연결 후보 업무.
  const clientWorkItems = useMemo(() => workItems.filter((w) => w.clientId === clientId), [workItems, clientId]);

  function setDraft(i: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function addDraft() {
    setDrafts((prev) => [...prev, emptyDraft()]);
  }
  function removeDraft(i: number) {
    setDrafts((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  // 필터(클라이언트 사이드)
  const [filterClient, setFilterClient] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const filtered = useMemo(
    () =>
      reports.filter(
        (r) => (!filterClient || r.clientId === filterClient) && (!filterDate || r.workDate === filterDate)
      ),
    [reports, filterClient, filterDate]
  );

  // 날짜별 그룹
  const grouped = useMemo(() => {
    const map = new Map<string, WorkReportRow[]>();
    for (const r of filtered) {
      const arr = map.get(r.workDate) ?? [];
      arr.push(r);
      map.set(r.workDate, arr);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  function submit() {
    setError(null);
    if (!clientId) {
      setError("거래처를 선택하세요.");
      return;
    }
    const items = drafts
      .map((d) => ({ title: d.title.trim(), link: d.link.trim() || null, note: d.note.trim() || null }))
      .filter((d) => d.title);
    if (items.length === 0) {
      setError("최소 한 건의 결과물 제목을 입력하세요.");
      return;
    }
    start(async () => {
      const res = await createWorkReports({ clientId, workDate, category, workItemId: workItemId || null, items });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDrafts([emptyDraft()]);
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      await deleteWorkReport({ id });
      router.refresh();
    });
  }

  if (clients.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-slate-500">
        담당 거래처가 없습니다. 거래처가 배정되면 업무 보고를 남길 수 있습니다.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* 작성 폼 — 여러 건 한 번에 */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="flex items-center gap-1.5 text-sm font-bold text-ink"><Plus className="h-4 w-4 text-brand" /> 오늘 작업 결과물 등록</p>
        <p className="mt-0.5 text-xs text-slate-500">완료한 결과물(예: 블로그 발행 링크)을 거래처별로 남깁니다. 하루에 여러 건이면 아래 ‘＋ 줄 추가’로 한 번에 올리세요.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            거래처
            <select value={clientId} onChange={(e) => { setClientId(e.target.value); setWorkItemId(""); }} className={inputCls}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            작업 일자
            <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            결과물 종류
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="기타">기타</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            연결 업무 (선택)
            <select value={workItemId} onChange={(e) => setWorkItemId(e.target.value)} className={inputCls} disabled={clientWorkItems.length === 0}>
              <option value="">연결 안 함</option>
              {clientWorkItems.map((w) => (
                <option key={w.id} value={w.id}>{w.title}</option>
              ))}
            </select>
          </label>
        </div>

        {/* 결과물 줄들 */}
        <div className="mt-3 space-y-2">
          {drafts.map((d, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-line bg-surface/40 p-2 sm:grid-cols-[1.2fr_1.4fr_1fr_auto]">
              <input value={d.title} onChange={(e) => setDraft(i, { title: e.target.value })} placeholder="제목/설명 (예: 임플란트 블로그 1건)" className={inputCls} />
              <input value={d.link} onChange={(e) => setDraft(i, { link: e.target.value })} placeholder="결과물 링크 (예: blog.naver.com/…)" className={inputCls} onKeyDown={(e) => e.key === "Enter" && submit()} />
              <input value={d.note} onChange={(e) => setDraft(i, { note: e.target.value })} placeholder="비고 (선택)" className={inputCls} />
              <button type="button" onClick={() => removeDraft(i)} disabled={drafts.length === 1} className="justify-self-end rounded-md p-2 text-slate-300 hover:bg-danger/10 hover:text-danger disabled:opacity-30" aria-label="줄 삭제">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={addDraft} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand hover:text-brand">
            <Plus className="h-3.5 w-3.5" /> 줄 추가
          </button>
          <span className="text-[11px] text-slate-400">여러 건을 같은 거래처·일자·종류로 한 번에 등록합니다.</span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={submit} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
            <Plus className="h-4 w-4" /> {drafts.length > 1 ? `${drafts.filter((d) => d.title.trim()).length}건 등록` : "결과물 등록"}
          </button>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm text-slate-600 outline-none focus:border-brand">
          <option value="">전체 거래처</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm text-slate-600 outline-none focus:border-brand" />
        {(filterClient || filterDate) && (
          <button type="button" onClick={() => { setFilterClient(""); setFilterDate(""); }} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm text-slate-500 hover:bg-surface">초기화</button>
        )}
        <span className="ml-auto text-xs text-slate-400">총 {filtered.length}건</span>
      </div>

      {/* 피드 */}
      {grouped.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface/50 px-4 py-10 text-center text-sm text-slate-500">
          등록된 업무 보고가 없습니다. 위에서 오늘 작업한 결과물을 남겨보세요.
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, items]) => (
            <div key={date} className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" /> {date} · {items.length}건
              </p>
              <div className="space-y-2">
                {items.map((r) => (
                  <div key={r.id} className="rounded-xl border border-line bg-card p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">{r.clientName}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{r.category}</span>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-ink">{r.title}</p>
                        {r.workItemTitle ? (
                          <span className="mt-1 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            <ClipboardList className="h-3 w-3" /> {r.workItemTitle}
                          </span>
                        ) : null}
                        {r.link ? (
                          <a href={r.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-strong hover:underline">
                            <Link2 className="h-3.5 w-3.5" /> <span className="truncate">{r.link}</span> <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : null}
                        {r.note ? <p className="mt-1 text-xs text-slate-500">{r.note}</p> : null}
                        <p className="mt-1 text-[10px] text-slate-400">{r.authorName}</p>
                      </div>
                      {(isManager || r.authorId === viewerId) && (
                        <button type="button" onClick={() => remove(r.id)} disabled={pending} className="shrink-0 rounded-md p-1 text-slate-300 hover:bg-danger/10 hover:text-danger" aria-label="삭제">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
