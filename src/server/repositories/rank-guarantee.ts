// 순위 보장 히트맵 데이터 — 보장 키워드(Keyword.isGuaranteed)의 최신 노출 순위를
// 거래처별로 묶어 상태(유지/미달/이탈/대기)로 판정한다. guard-rank 잡이 매일 적재한
// ExposureSnapshot 을 소비만 한다(추가 수집 없음).

import { Role } from "@/domain/types";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

export type GuaranteeStatus = "MAINTAINED" | "BELOW_TARGET" | "DROPPED" | "PENDING";

export type GuaranteeCell = {
  keywordId: string;
  keyword: string;
  channel: string;
  targetRank: number | null;
  rank: number | null;
  checkedOn: string | null;
  status: GuaranteeStatus;
};

export type GuaranteeClientRow = {
  clientId: string;
  clientName: string;
  cells: GuaranteeCell[];
  dropped: number;
  belowTarget: number;
  maintained: number;
};

export type GuaranteeHeatmap = {
  rows: GuaranteeClientRow[];
  totalKeywords: number;
  droppedTotal: number;
  belowTotal: number;
};

const EMPTY: GuaranteeHeatmap = { rows: [], totalKeywords: 0, droppedTotal: 0, belowTotal: 0 };

function statusOf(rank: number | null, targetRank: number | null, hasSnapshot: boolean): GuaranteeStatus {
  if (!hasSnapshot) return "PENDING"; // 아직 측정 이력 없음
  if (rank == null) return "DROPPED"; // 미노출/이탈
  if (targetRank != null && rank > targetRank) return "BELOW_TARGET"; // 목표 순위 미달
  return "MAINTAINED"; // 노출 + 목표 충족(목표 없으면 노출만으로 유지)
}

export async function guaranteeHeatmap(user: CurrentUser): Promise<GuaranteeHeatmap> {
  // 담당자는 본인 담당 거래처만, 관리자·최고관리자는 전체(effective role 기준).
  const scope = user.role === Role.MARKETER ? { client: { assignedMarketerId: user.id } } : {};

  const keywords = await db.keyword
    .findMany({
      where: { isGuaranteed: true, ...scope },
      select: {
        id: true,
        keyword: true,
        guardChannel: true,
        targetRank: true,
        client: { select: { id: true, name: true } },
        snapshots: { orderBy: { checkedOn: "desc" }, take: 1, select: { rank: true, checkedOn: true, channel: true } }
      },
      orderBy: [{ clientId: "asc" }, { priority: "asc" }, { keyword: "asc" }]
    })
    .catch(() => []);

  if (keywords.length === 0) return EMPTY;

  const byClient = new Map<string, GuaranteeClientRow>();
  let droppedTotal = 0;
  let belowTotal = 0;

  for (const k of keywords) {
    const snap = k.snapshots[0] ?? null;
    const rank = snap?.rank ?? null;
    const status = statusOf(rank, k.targetRank, Boolean(snap));
    if (status === "DROPPED") droppedTotal++;
    if (status === "BELOW_TARGET") belowTotal++;

    const cell: GuaranteeCell = {
      keywordId: k.id,
      keyword: k.keyword,
      channel: snap?.channel ?? k.guardChannel,
      targetRank: k.targetRank,
      rank,
      checkedOn: snap?.checkedOn ? snap.checkedOn.toISOString().slice(0, 10) : null,
      status
    };

    let row = byClient.get(k.client.id);
    if (!row) {
      row = { clientId: k.client.id, clientName: k.client.name, cells: [], dropped: 0, belowTarget: 0, maintained: 0 };
      byClient.set(k.client.id, row);
    }
    row.cells.push(cell);
    if (status === "DROPPED") row.dropped++;
    else if (status === "BELOW_TARGET") row.belowTarget++;
    else if (status === "MAINTAINED") row.maintained++;
  }

  // 위험(이탈>미달)이 많은 거래처를 위로.
  const rows = [...byClient.values()].sort((a, b) => b.dropped - a.dropped || b.belowTarget - a.belowTarget || a.clientName.localeCompare(b.clientName));

  return { rows, totalKeywords: keywords.length, droppedTotal, belowTotal };
}
