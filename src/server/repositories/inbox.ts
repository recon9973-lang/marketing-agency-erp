import type { CurrentUser } from "@/domain/access-control";
import { db } from "@/server/db";
import { listRoomsForUser } from "@/server/repositories/chat";
import { buildAccessibleClientWhere, loadAccessScopes } from "@/server/scope";

/**
 * 대시보드 '바로가기 현황' 데이터 (워크플로우 15차).
 * 최근 모듈(메시지·보관함·플레이스 순위)의 실행 가능한 신호를 접근 권한 범위에서 모은다.
 */

export type InboxRank = {
  clientId: string;
  clientName: string;
  keyword: string;
  rank: number;
  recordedOn: string;
};

export type InboxSummary = {
  unreadMessages: number;
  vaultFileCount: number;
  latestVaultFileName: string | null;
  recentRanks: InboxRank[];
};

export async function getInboxSummary(user: CurrentUser): Promise<InboxSummary> {
  const scopes = await loadAccessScopes(user);
  const clientWhere = buildAccessibleClientWhere(user, scopes);

  const [rooms, vaultFileCount, latestVaultFile, recentRanks] = await Promise.all([
    listRoomsForUser(user.id),
    db.storedFile.count({ where: { inVault: true } }),
    db.storedFile.findFirst({
      where: { inVault: true },
      orderBy: { createdAt: "desc" },
      select: { fileName: true }
    }),
    db.placeRankRecord.findMany({
      where: { client: clientWhere },
      orderBy: [{ recordedOn: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        rank: true,
        keyword: true,
        recordedOn: true,
        client: { select: { id: true, name: true } }
      }
    })
  ]);

  return {
    unreadMessages: rooms.reduce((sum, room) => sum + room.unreadCount, 0),
    vaultFileCount,
    latestVaultFileName: latestVaultFile?.fileName ?? null,
    recentRanks: recentRanks.map((record) => ({
      clientId: record.client.id,
      clientName: record.client.name,
      keyword: record.keyword,
      rank: record.rank,
      recordedOn: record.recordedOn.toISOString().slice(0, 10)
    }))
  };
}
