// 플랫폼 공지 관리(관리자) — 수동 등록 + 고정/삭제 + 온디맨드 자동 수집.
// 자동 수집이 못 잡는 네이버 공지 등을 여기서 직접 등록하면 배너에 즉시 반영된다.
"use client";

import { useState, useTransition } from "react";
import { addPlatformUpdate, deletePlatformUpdate, togglePinPlatformUpdate, refreshPlatformUpdatesNow } from "@/server/actions/platform-updates";
import { CATEGORY_LABEL, PLATFORM_LABEL, type PlatformKind, type UpdateCategory } from "@/domain/platform-updates";

type Row = {
  id: string;
  platform: PlatformKind;
  category: UpdateCategory;
  title: string;
  url: string | null;
  source: string;
  publishedAt: string;
  pinned: boolean;
  isManual: boolean;
};

const PLATFORMS: PlatformKind[] = ["NAVER", "GOOGLE", "ETC"];
const CATEGORIES: UpdateCategory[] = ["BLOG", "PLACE", "CAFE", "ALGORITHM", "SEO", "GEO", "GENERAL"];

export function PlatformUpdatesManager({ rows }: { rows: Row[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function add(formData: FormData) {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await addPlatformUpdate({
        platform: String(formData.get("platform")),
        category: String(formData.get("category")),
        title: String(formData.get("title")),
        url: String(formData.get("url") ?? ""),
        summary: String(formData.get("summary") ?? "")
      });
      if (!res.ok) setError(res.error);
      else setNotice("공지를 등록했습니다. 배너에 곧 반영됩니다.");
    });
  }
  function remove(id: string) {
    setError(null);
    start(async () => { const res = await deletePlatformUpdate({ id }); if (!res.ok) setError(res.error); });
  }
  function togglePin(id: string, pinned: boolean) {
    setError(null);
    start(async () => { const res = await togglePinPlatformUpdate({ id, pinned }); if (!res.ok) setError(res.error); });
  }
  function refresh() {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await refreshPlatformUpdatesNow();
      if (!res.ok) setError(res.error);
      else setNotice(`자동 수집 완료 — 새 공지 ${res.data?.inserted ?? 0}건 (조회 ${res.data?.fetched ?? 0}건${res.data?.failed ? `, 실패 ${res.data.failed}` : ""}).`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={refresh} disabled={pending} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
          지금 자동 수집
        </button>
        <span className="text-xs text-slate-500">구글 Search Central·등록된 네이버 RSS를 즉시 당겨옵니다. 네이버 공지는 아래에서 수동 등록도 가능합니다.</span>
      </div>

      <form action={add} className="grid grid-cols-1 gap-2 rounded-md border border-line p-4 md:grid-cols-2">
        <label className="block"><span className="text-xs text-slate-500">플랫폼</span>
          <select name="platform" className="mt-1 w-full rounded-md border border-line px-2 py-1 text-sm">
            {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
          </select>
        </label>
        <label className="block"><span className="text-xs text-slate-500">카테고리</span>
          <select name="category" className="mt-1 w-full rounded-md border border-line px-2 py-1 text-sm">
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="block md:col-span-2"><span className="text-xs text-slate-500">제목</span>
          <input name="title" required maxLength={300} className="mt-1 w-full rounded-md border border-line px-2 py-1 text-sm" placeholder="예: 네이버 스마트플레이스 순위 로직 업데이트 안내" />
        </label>
        <label className="block md:col-span-2"><span className="text-xs text-slate-500">링크(URL, 선택)</span>
          <input name="url" type="url" className="mt-1 w-full rounded-md border border-line px-2 py-1 text-sm" placeholder="https://searchadvisor.naver.com/notice/..." />
        </label>
        <label className="block md:col-span-2"><span className="text-xs text-slate-500">요약(선택)</span>
          <input name="summary" maxLength={500} className="mt-1 w-full rounded-md border border-line px-2 py-1 text-sm" />
        </label>
        <div className="md:col-span-2">
          <button type="submit" disabled={pending} className="rounded-md bg-ink px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">공지 등록</button>
        </div>
      </form>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {notice && <p className="text-sm text-emerald-600">{notice}</p>}

      <table className="w-full text-sm">
        <thead><tr className="text-left text-slate-500"><th className="py-2">플랫폼</th><th>카테고리</th><th>제목</th><th>출처</th><th>고정</th><th></th></tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6} className="py-4 text-center text-slate-400">등록된 공지가 없습니다. “지금 자동 수집”을 눌러보세요.</td></tr>
          ) : rows.map((r) => (
            <tr key={r.id} className="border-t align-top">
              <td className="py-2">{PLATFORM_LABEL[r.platform]}</td>
              <td>{CATEGORY_LABEL[r.category]}</td>
              <td className="max-w-[22rem]">
                {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-brand-strong hover:underline">{r.title}</a> : r.title}
              </td>
              <td><span className="text-xs text-slate-400">{r.isManual ? "수동" : r.source}</span></td>
              <td>
                <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={r.pinned} onChange={(e) => togglePin(r.id, e.target.checked)} disabled={pending} />
                  {r.pinned ? "고정" : ""}
                </label>
              </td>
              <td>
                <button type="button" onClick={() => remove(r.id)} disabled={pending} className="text-xs text-rose-500 hover:underline disabled:opacity-50">삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
