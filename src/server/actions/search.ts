// ERP 내부 검색 — 데이터 검색 서버 액션(로그인 사용자 전용, 역할 스코프 적용).
"use server";

import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";
import { searchErp, quickAccessFavorites, type SearchHit } from "@/server/repositories/search";

export async function erpSearchAction(query: unknown): Promise<ActionResult<{ hits: SearchHit[] }>> {
  return runAction(async () => {
    const user = await requireUser();
    const q = typeof query === "string" ? query : "";
    if (q.trim().length < 1) return { hits: [] };
    const hits = await searchErp(user, q.slice(0, 100));
    return { hits };
  });
}

/** 빈 검색 상태의 빠른 접근 — 즐겨찾기 거래처. */
export async function erpQuickAccessAction(): Promise<ActionResult<{ favorites: SearchHit[] }>> {
  return runAction(async () => {
    const user = await requireUser();
    const favorites = await quickAccessFavorites(user);
    return { favorites };
  });
}
