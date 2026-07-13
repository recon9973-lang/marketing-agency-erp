// ERP 내부 검색창 — 대시보드용. 페이지 바로가기·사용방법(즉시) + 데이터(서버) 통합 검색.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Search,
  ArrowRight,
  CornerDownLeft,
  BookOpen,
  Compass,
  BriefcaseBusiness,
  ClipboardList,
  FileSignature,
  FileText,
  Archive
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Role } from "@/domain/types";
import { searchCatalog, type CatalogItem } from "@/domain/search/catalog";
import { erpSearchAction } from "@/server/actions/search";
import type { SearchHit, SearchHitType } from "@/server/repositories/search";

type FlatItem = { href: string; title: string; sub: string | null };
type Group = { key: string; label: string; icon: LucideIcon; items: FlatItem[] };

const HIT_META: Record<SearchHitType, { label: string; icon: LucideIcon }> = {
  client: { label: "거래처", icon: BriefcaseBusiness },
  work: { label: "업무", icon: ClipboardList },
  contract: { label: "계약", icon: FileSignature },
  report: { label: "보고서", icon: FileText },
  file: { label: "파일", icon: Archive }
};

const HIT_ORDER: SearchHitType[] = ["client", "work", "contract", "report", "file"];

function buildGroups(catalog: CatalogItem[], hits: SearchHit[]): Group[] {
  const groups: Group[] = [];
  const pages = catalog.filter((c) => c.kind === "page");
  const help = catalog.filter((c) => c.kind === "help");
  if (pages.length) groups.push({ key: "page", label: "바로가기", icon: Compass, items: pages.map((p) => ({ href: p.href, title: p.title, sub: p.description })) });
  if (help.length) groups.push({ key: "help", label: "사용방법", icon: BookOpen, items: help.map((h) => ({ href: h.href, title: h.title, sub: h.description })) });
  for (const t of HIT_ORDER) {
    const items = hits.filter((h) => h.type === t).map((h) => ({ href: h.href, title: h.title, sub: h.sublabel }));
    if (items.length) groups.push({ key: t, label: HIT_META[t].label, icon: HIT_META[t].icon, items });
  }
  return groups;
}

export function ErpSearch({ role }: { role: Role }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  const catalog = useMemo(() => searchCatalog(query, role, 8), [query, role]);
  const groups = useMemo(() => buildGroups(catalog, hits), [catalog, hits]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // 데이터(서버) 검색 — 200ms 디바운스, 최신 요청만 반영.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const myId = ++reqId.current;
    const timer = setTimeout(async () => {
      const res = await erpSearchAction(q);
      if (myId !== reqId.current) return; // 오래된 응답 폐기
      setHits(res.ok ? res.data?.hits ?? [] : []);
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => setActive(0), [query]);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href as Route);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(0, flat.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[active];
      if (item) go(item.href);
    } else if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
    }
  }

  const showPanel = open && query.trim().length > 0;
  let runningIndex = -1;

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2.5 focus-within:border-brand">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
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
          {flat.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">
              {loading ? "검색 중…" : "결과가 없습니다."}
            </p>
          ) : (
            groups.map((g) => {
              const Icon = g.icon;
              return (
                <div key={g.key} className="mb-1.5 last:mb-0">
                  <p className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    <Icon className="h-3 w-3" /> {g.label}
                  </p>
                  {g.items.map((item) => {
                    runningIndex += 1;
                    const idx = runningIndex;
                    const isActive = idx === active;
                    return (
                      <button
                        key={`${g.key}-${idx}`}
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(item.href)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ${
                          isActive ? "bg-brand/10" : "hover:bg-surface"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                          {item.sub && <span className="block truncate text-xs text-slate-400">{item.sub}</span>}
                        </span>
                        {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-brand" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
