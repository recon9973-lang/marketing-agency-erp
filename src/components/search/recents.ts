// ERP 검색 최근 항목 — 선택한 결과를 localStorage에 기록해 빈 검색 상태에서 다시 보여준다.
// 서버 부담 없는 클라이언트 전용 저장소. 브라우저(기기)별로 유지된다.
"use client";

export type RecentItem = { href: string; title: string; sub: string | null; groupKey: string };

const KEY = "erp:search:recents";
const MAX = 6;

function safeParse(raw: string | null): RecentItem[] {
  if (!raw) return [];
  try {
    const val = JSON.parse(raw);
    if (!Array.isArray(val)) return [];
    return val.filter(
      (v): v is RecentItem =>
        !!v && typeof v.href === "string" && typeof v.title === "string" && typeof v.groupKey === "string"
    );
  } catch {
    return [];
  }
}

export function getRecents(): RecentItem[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(KEY)).slice(0, MAX);
}

// 최근 항목 추가 — 같은 href는 최상단으로 끌어올리고(중복 제거) 최대 MAX개만 유지.
export function pushRecent(item: RecentItem): RecentItem[] {
  if (typeof window === "undefined") return [];
  const next = [item, ...getRecents().filter((r) => r.href !== item.href)].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장 실패(용량/프라이빗 모드)는 조용히 무시 — 기능은 계속 동작.
  }
  return next;
}

export function clearRecents(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
  return [];
}
