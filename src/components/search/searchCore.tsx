// ERP 내부 검색 — 공용 코어(훅 + 결과 리스트). 인라인(대시보드)·팔레트(전역) 양쪽이 재사용.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  ArrowRight,
  BookOpen,
  Clock,
  Compass,
  BriefcaseBusiness,
  ClipboardList,
  FileSignature,
  FileText,
  PenLine,
  Video,
  Newspaper,
  Archive
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Role } from "@/domain/types";
import { searchCatalog, type CatalogItem } from "@/domain/search/catalog";
import { erpSearchAction } from "@/server/actions/search";
import type { SearchHit, SearchHitType } from "@/server/repositories/search";
import { getRecents, pushRecent, clearRecents, type RecentItem } from "@/components/search/recents";

export type FlatItem = { href: string; title: string; sub: string | null; groupKey: string };
export type Group = { key: string; label: string; icon: LucideIcon; items: FlatItem[] };

const HIT_META: Record<SearchHitType, { label: string; icon: LucideIcon }> = {
  client: { label: "거래처", icon: BriefcaseBusiness },
  work: { label: "업무", icon: ClipboardList },
  contract: { label: "계약", icon: FileSignature },
  report: { label: "보고서", icon: FileText },
  content: { label: "원고", icon: PenLine },
  meeting: { label: "회의록", icon: Video },
  magazine: { label: "매거진", icon: Newspaper },
  file: { label: "파일", icon: Archive }
};

const HIT_ORDER: SearchHitType[] = ["client", "work", "contract", "report", "content", "meeting", "magazine", "file"];

function buildGroups(catalog: CatalogItem[], hits: SearchHit[]): Group[] {
  const groups: Group[] = [];
  const pages = catalog.filter((c) => c.kind === "page");
  const help = catalog.filter((c) => c.kind === "help");
  if (pages.length)
    groups.push({ key: "page", label: "바로가기", icon: Compass, items: pages.map((p) => ({ href: p.href, title: p.title, sub: p.description, groupKey: "page" })) });
  if (help.length)
    groups.push({ key: "help", label: "사용방법", icon: BookOpen, items: help.map((h) => ({ href: h.href, title: h.title, sub: h.description, groupKey: "help" })) });
  for (const t of HIT_ORDER) {
    const items = hits.filter((h) => h.type === t).map((h) => ({ href: h.href, title: h.title, sub: h.sublabel, groupKey: t }));
    if (items.length) groups.push({ key: t, label: HIT_META[t].label, icon: HIT_META[t].icon, items });
  }
  return groups;
}

export function useErpSearch(role: Role, onNavigate?: () => void) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const reqId = useRef(0);

  // 최근 항목은 클라이언트 마운트 후 로드 — SSR/하이드레이션 불일치 방지.
  useEffect(() => setRecents(getRecents()), []);

  const catalog = useMemo(() => searchCatalog(query, role, 8), [query, role]);
  const searchGroups = useMemo(() => buildGroups(catalog, hits), [catalog, hits]);

  const isEmptyQuery = query.trim().length === 0;
  const recentGroups = useMemo<Group[]>(
    () =>
      recents.length
        ? [{ key: "recent", label: "최근", icon: Clock, items: recents.map((r) => ({ href: r.href, title: r.title, sub: r.sub, groupKey: r.groupKey })) }]
        : [],
    [recents]
  );

  // 빈 검색 상태에서는 최근 항목을, 입력이 있으면 검색 결과를 노출.
  const groups = isEmptyQuery ? recentGroups : searchGroups;
  const showingRecents = isEmptyQuery && recentGroups.length > 0;
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

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
      if (myId !== reqId.current) return;
      setHits(res.ok ? res.data?.hits ?? [] : []);
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => setActive(0), [query]);

  function go(item: FlatItem) {
    setRecents(pushRecent({ href: item.href, title: item.title, sub: item.sub, groupKey: item.groupKey }));
    setQuery("");
    onNavigate?.();
    router.push(item.href as Route);
  }

  function clearAll() {
    setRecents(clearRecents());
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
      if (item) go(item);
    }
  }

  return { query, setQuery, hits, loading, active, setActive, groups, flat, go, onKey, isEmptyQuery, showingRecents, clearAll };
}

export function SearchResultsList({
  groups,
  active,
  setActive,
  onSelect,
  loading,
  onClear,
  emptyText = "결과가 없습니다."
}: {
  groups: Group[];
  active: number;
  setActive: (i: number) => void;
  onSelect: (item: FlatItem) => void;
  loading: boolean;
  onClear?: () => void;
  emptyText?: string;
}) {
  const flatLen = groups.reduce((s, g) => s + g.items.length, 0);
  if (flatLen === 0) {
    return <p className="px-3 py-6 text-center text-sm text-slate-400">{loading ? "검색 중…" : emptyText}</p>;
  }
  let idx = -1;
  return (
    <>
      {groups.map((g) => {
        const Icon = g.icon;
        return (
          <div key={g.key} className="mb-1.5 last:mb-0">
            <p className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              <Icon className="h-3 w-3" /> {g.label}
              {g.key === "recent" && onClear && (
                <button type="button" onClick={onClear} className="ml-auto rounded px-1 text-[10px] font-medium normal-case text-slate-400 hover:text-brand">
                  지우기
                </button>
              )}
            </p>
            {g.items.map((item) => {
              idx += 1;
              const myIdx = idx;
              const isActive = myIdx === active;
              return (
                <button
                  key={`${g.key}-${myIdx}`}
                  type="button"
                  onMouseEnter={() => setActive(myIdx)}
                  onClick={() => onSelect(item)}
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
      })}
    </>
  );
}
