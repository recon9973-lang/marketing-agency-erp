// ERP 내부 검색창 — 대시보드용 인라인. 공용 코어(searchCore) 재사용.
"use client";

import { useEffect, useRef, useState } from "react";
import { Search, CornerDownLeft } from "lucide-react";
import { Role } from "@/domain/types";
import { useErpSearch, SearchResultsList } from "@/components/search/searchCore";

export function ErpSearch({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const { query, setQuery, loading, active, setActive, groups, onKey, go } = useErpSearch(role, () => setOpen(false));

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const showPanel = open && query.trim().length > 0;

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2.5 focus-within:border-brand">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              setOpen(false);
            } else onKey(e);
          }}
          placeholder="ERP 검색 — 거래처·업무·계약·파일, 사용방법…"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
          aria-label="ERP 내부 검색"
        />
        {loading ? (
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-line border-t-brand" />
        ) : (
          <span className="hidden items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[10px] text-slate-400 sm:flex">
            <CornerDownLeft className="h-3 w-3" /> 이동
          </span>
        )}
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[60vh] overflow-y-auto rounded-xl border border-line bg-card p-2 shadow-xl">
          <SearchResultsList groups={groups} active={active} setActive={setActive} onSelect={go} loading={loading} />
        </div>
      )}
    </div>
  );
}
