"use server";

// src/server/actions/exposure.ts
//
// 월보장 키워드 등록·설정 저장. 담당 마케터 또는 관리자만 수정 가능.
// Keyword의 월보장 필드(isGuaranteed/targetRank/guardChannel/guardTarget)를 upsert.

import { revalidatePath } from "next/cache";
import { Role } from "@/domain/types";
import { db } from "@/server/db";
import { requireUser } from "@/server/actions/_helpers";
import { collectRanksForClient } from "@/server/jobs/guard-rank";

export type SaveGuardKeywordInput = {
  clientId: string;
  keywordId?: string; // 있으면 수정, 없으면 신규
  keyword: string;
  isGuaranteed: boolean;
  targetRank: number | null;
  guardChannel: string; // blog|web|local
  guardTarget: string | null;
};

export type SaveGuardKeywordResult = { ok: true } | { ok: false; error: string };

const CHANNELS = ["blog", "web", "local"];

export type RefreshRanksResult = { ok: true; measured: number; scanned: number } | { ok: false; error: string };

/** "지금 순위 확인" — 한 거래처의 월보장 키워드 순위를 즉시 수집(크론 대기 없이). */
export async function refreshClientRanks(clientId: string): Promise<RefreshRanksResult> {
  try {
    const user = await requireUser();
    const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true, assignedMarketerId: true } });
    if (!client) return { ok: false, error: "NOT_FOUND" };
    const allowed = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN || client.assignedMarketerId === user.id;
    if (!allowed) return { ok: false, error: "FORBIDDEN" };

    const r = await collectRanksForClient(clientId);
    revalidatePath(`/clients/${clientId}`);
    return { ok: true, measured: r.measured, scanned: r.scanned };
  } catch {
    return { ok: false, error: "FAILED" };
  }
}

export async function saveGuardKeyword(input: SaveGuardKeywordInput): Promise<SaveGuardKeywordResult> {
  try {
    const user = await requireUser();
    const client = await db.client.findUnique({
      where: { id: input.clientId },
      select: { id: true, assignedMarketerId: true },
    });
    if (!client) return { ok: false, error: "NOT_FOUND" };

    const allowed =
      user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN || client.assignedMarketerId === user.id;
    if (!allowed) return { ok: false, error: "FORBIDDEN" };

    const keyword = (input.keyword || "").trim();
    if (!keyword) return { ok: false, error: "VALIDATION" };

    const guardChannel = CHANNELS.includes(input.guardChannel) ? input.guardChannel : "blog";
    const targetRank =
      input.targetRank != null && Number.isFinite(input.targetRank) && input.targetRank > 0
        ? Math.floor(input.targetRank)
        : null;
    const guardTarget = input.guardTarget?.trim() ? input.guardTarget.trim() : null;

    const data = { keyword, isGuaranteed: input.isGuaranteed, targetRank, guardChannel, guardTarget };

    if (input.keywordId) {
      // 대상 키워드가 이 거래처 소속인지 확인 후 수정.
      const existing = await db.keyword.findFirst({
        where: { id: input.keywordId, clientId: input.clientId },
        select: { id: true },
      });
      if (!existing) return { ok: false, error: "NOT_FOUND" };
      await db.keyword.update({ where: { id: input.keywordId }, data });
    } else {
      await db.keyword.create({ data: { clientId: input.clientId, channel: "blog", ...data } });
    }

    revalidatePath(`/clients/${input.clientId}`);
    return { ok: true };
  } catch (e) {
    console.error("[saveGuardKeyword]", e);
    return { ok: false, error: "UNKNOWN" };
  }
}
