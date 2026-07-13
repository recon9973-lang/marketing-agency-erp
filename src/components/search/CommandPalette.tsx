// ERP 전역 커맨드 팔레트 — 어디서든 ⌘K/Ctrl+K로 열어 통합 검색. 공용 코어 재사용.
"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Role } from "@/domain/types";
import { useErpSearch, SearchResultsList } from "@/components/search/searchCore";

export function CommandPalette({ role, open, onClose }: { role: Role; open: boolean; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, setQuery, loading, active, setActive, groups, onKey, go } = useErpSearch(role, onClose);

  useEffect(() => {
    if (open) {
      // 열릴 때 입력 초기화 + 포커스
      setQuery("");
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open, setQuery]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="ERP 검색"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else onKey(e);
            }}
            placeholder="거래처·업무·계약·파일 검색, 또는 사용방법…"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-slate-400"
            aria-label="ERP 통합 검색"
          />
          {loading ? (
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-brand" />
          ) : (
            <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-slate-400">ESC</kbd>
          )}
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {query.trim().length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-400">
              무엇이든 검색하세요 — 페이지 이동, 사용방법, 거래처·업무·계약·보고서·파일
            </p>
          ) : (
            <SearchResultsList groups={groups} active={active} setActive={setActive} onSelect={go} loading={loading} />
          )}
        </div>
      </div>
    </div>
  );
}
