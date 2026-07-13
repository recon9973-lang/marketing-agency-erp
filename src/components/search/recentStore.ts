// 최근 방문 저장 — 검색으로 이동한 항목을 localStorage에 쌓아 빈 검색 상태에 노출한다.
"use client";

const KEY = "erp:recent";
const MAX = 8;

export type RecentItem = { href: string; title: string; sub: string | null };

export function getRecent(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(item: RecentItem): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const next = [item, ...getRecent().filter((r) => r.href !== item.href)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return getRecent();
  }
}
