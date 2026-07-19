// src/server/jobs/guard-rank.ts
//
// 월보장(순위 보장) 키워드 감시 — MarketerOps Phase 1.
// 크론에서 하루 1회 호출. 계약상 순위를 보장한 키워드(Keyword.isGuaranteed)의
// 네이버 노출 순위를 공식 검색 API(naverResearch.rankCheck)로 조회해:
//   ① ExposureSnapshot 에 오늘자 순위를 적재(upsert, 멱등)
//   ② 이탈(미노출) / 목표순위 미달 / 급락 시 담당 마케터에게 Notification 발송
//
// 설계 원칙(기획서/엔진 주석과 동일):
//   - 공식 오픈 API만 사용(SERP 크롤링 금지). rank=null 은 미노출/조회실패 —
//     "미노출로 단정"하지 않고 그대로 기록하되, 보장 키워드 이탈은 CRIT로 알린다.
//   - 같은 키워드·같은 날 중복 알림 방지(멱등). 네이버 키 미설정 시 조용히 skip.
//   - 파워링크·플레이스·클립·브랜드콘텐츠 등 광고/비공개 영역은 대상 아님(수동 유지).

import { db } from "@/server/db";
import { naverResearch } from "@/server/marketing/providers/naver";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

type GuardChannel = "blog" | "web" | "local";

function normChannel(v: string | null | undefined): GuardChannel {
  return v === "web" || v === "local" ? v : "blog";
}

/** 순위 판정 대상 문자열 해석: guardTarget → primary 계정 URL/핸들 → 거래처명. */
function resolveTarget(kw: {
  guardTarget: string | null;
  client: { name: string; accounts: { externalUrl: string | null; handle: string | null; isPrimary: boolean }[] };
}): string | null {
  if (kw.guardTarget && kw.guardTarget.trim()) return kw.guardTarget.trim();
  const accounts = kw.client.accounts;
  const primary = accounts.find((a) => a.isPrimary) ?? accounts[0];
  const fromAccount = primary?.externalUrl || primary?.handle;
  if (fromAccount && fromAccount.trim()) return fromAccount.trim();
  return kw.client.name || null;
}

export type GuardAlert = { type: string; level: string } | null;

/**
 * 순수 판정 로직 — 오늘 순위(rank), 보장 목표순위(targetRank), 직전 순위(prevRank)로
 * 알림 종류를 결정한다. rank=null(미노출) > 목표 미달 > 급락 순으로 우선.
 * 테스트 가능하도록 DB/IO와 분리.
 */
export function decideGuardAlert(rank: number | null, targetRank: number | null, prevRank: number | null): GuardAlert {
  if (rank === null) {
    return { type: "GUARD_RANK_UNEXPOSED", level: "🔴 이탈(미노출)" };
  }
  if (targetRank != null && rank > targetRank) {
    return { type: "GUARD_RANK_BELOW_TARGET", level: `🟠 목표 미달(${rank}위 / 목표 ${targetRank}위)` };
  }
  if (prevRank != null && rank > prevRank + 3) {
    return { type: "GUARD_RANK_DROP", level: `🟡 급락(${prevRank}위 → ${rank}위)` };
  }
  return null;
}

async function alreadySentToday(userId: string, type: string, targetId: string, todayStart: Date): Promise<boolean> {
  const existing = await db.notification.findFirst({
    where: { userId, type, targetId, createdAt: { gte: todayStart } },
    select: { id: true },
  });
  return Boolean(existing);
}

export type GuardRankResult = {
  scanned: number;
  measured: number;
  unexposed: number;
  belowTarget: number;
  dropped: number;
  alerts: number;
  skipped: number; // 대상 해석 실패·키 미설정 등으로 건너뜀
};

/**
 * 월보장 키워드 감시 스위프. 크론(하루 1회)에서 호출.
 * @param now 기준 시각(테스트 주입용).
 */
export async function runGuardRankWatch(now = new Date()): Promise<GuardRankResult> {
  const todayStart = dayStart(now);
  const result: GuardRankResult = {
    scanned: 0,
    measured: 0,
    unexposed: 0,
    belowTarget: 0,
    dropped: 0,
    alerts: 0,
    skipped: 0,
  };

  const keywords = await db.keyword.findMany({
    where: { isGuaranteed: true, client: { active: true } },
    select: {
      id: true,
      keyword: true,
      targetRank: true,
      guardChannel: true,
      guardTarget: true,
      orgId: true,
      client: {
        select: {
          id: true,
          name: true,
          assignedMarketerId: true,
          accounts: { select: { externalUrl: true, handle: true, isPrimary: true } },
        },
      },
    },
    take: 500,
  });
  result.scanned = keywords.length;

  for (const kw of keywords) {
    const target = resolveTarget(kw);
    if (!target) {
      result.skipped++;
      continue;
    }
    const channel = normChannel(kw.guardChannel);

    const res = await naverResearch.rankCheck({ keywords: [kw.keyword], target, channel });
    if (!res.ok) {
      // 키 미설정(CONFIG_MISSING) 등 — 배치를 죽이지 않고 skip.
      result.skipped++;
      continue;
    }
    const rank = res.data[0]?.rank ?? null;
    result.measured++;

    // 직전(오늘 이전) 스냅샷 — 급락 판정용.
    const prev = await db.exposureSnapshot.findFirst({
      where: { keywordId: kw.id, channel, checkedOn: { lt: todayStart } },
      orderBy: { checkedOn: "desc" },
      select: { rank: true },
    });
    const prevRank = prev?.rank ?? null;

    // 오늘자 스냅샷 적재(멱등 upsert).
    await db.exposureSnapshot.upsert({
      where: { keywordId_channel_checkedOn: { keywordId: kw.id, channel, checkedOn: todayStart } },
      create: { keywordId: kw.id, channel, checkedOn: todayStart, rank, source: "naver", orgId: kw.orgId },
      update: { rank, source: "naver" },
    });

    // ── 알림 판정 ──
    const decision = decideGuardAlert(rank, kw.targetRank, prevRank);
    if (!decision) continue;
    const { type, level } = decision;
    if (type === "GUARD_RANK_UNEXPOSED") result.unexposed++;
    else if (type === "GUARD_RANK_BELOW_TARGET") result.belowTarget++;
    else if (type === "GUARD_RANK_DROP") result.dropped++;

    const userId = kw.client.assignedMarketerId;
    if (!userId) {
      // 담당자 미배정 — 알림 대상이 없어 스냅샷만 남기고 skip.
      continue;
    }
    if (await alreadySentToday(userId, type, kw.id, todayStart)) continue;

    await db.notification.create({
      data: {
        userId,
        type,
        title: `[월보장] '${kw.keyword}' ${level}`,
        body: `${kw.client.name} · ${channel} 채널 · ${todayStart.toISOString().slice(0, 10)} 감지`,
        link: `/clients/${kw.client.id}`,
        targetType: "Keyword",
        targetId: kw.id,
      },
    });
    result.alerts++;
  }

  return result;
}

export type ClientRankResult = { scanned: number; measured: number; skipped: number };

/** 한 거래처의 월보장 키워드 순위를 즉시 수집(수동 "지금 확인"). 알림 없이 스냅샷만 갱신.
 *  크론(runGuardRankWatch)과 동일한 rankCheck·upsert 로직을 재사용. */
export async function collectRanksForClient(clientId: string, now = new Date()): Promise<ClientRankResult> {
  const todayStart = dayStart(now);
  const result: ClientRankResult = { scanned: 0, measured: 0, skipped: 0 };

  const keywords = await db.keyword.findMany({
    where: { clientId, isGuaranteed: true },
    select: {
      id: true,
      keyword: true,
      guardChannel: true,
      guardTarget: true,
      orgId: true,
      client: { select: { name: true, accounts: { select: { externalUrl: true, handle: true, isPrimary: true } } } },
    },
    take: 100,
  });
  result.scanned = keywords.length;

  for (const kw of keywords) {
    const target = resolveTarget(kw);
    if (!target) {
      result.skipped++;
      continue;
    }
    const channel = normChannel(kw.guardChannel);
    const res = await naverResearch.rankCheck({ keywords: [kw.keyword], target, channel });
    if (!res.ok) {
      result.skipped++;
      continue;
    }
    const rank = res.data[0]?.rank ?? null;
    result.measured++;
    await db.exposureSnapshot.upsert({
      where: { keywordId_channel_checkedOn: { keywordId: kw.id, channel, checkedOn: todayStart } },
      create: { keywordId: kw.id, channel, checkedOn: todayStart, rank, source: "naver", orgId: kw.orgId },
      update: { rank, source: "naver" },
    });
  }

  return result;
}
