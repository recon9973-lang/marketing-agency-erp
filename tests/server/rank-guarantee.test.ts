import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/domain/types";
import type { CurrentUser } from "@/server/session";

const keywordFindManyMock = vi.fn();

vi.mock("@/server/db", () => ({
  db: { keyword: { findMany: keywordFindManyMock } }
}));

function superAdmin(): CurrentUser {
  return { id: "root", name: "Root", email: "root@a.test", role: Role.SUPER_ADMIN, baseRole: Role.SUPER_ADMIN, elevatedToSuperAdmin: false, canAccessSettings: true };
}
function marketer(): CurrentUser {
  return { id: "mk-1", name: "MK", email: "mk@a.test", role: Role.MARKETER, baseRole: Role.MARKETER, elevatedToSuperAdmin: false, canAccessSettings: false };
}

const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("guaranteeHeatmap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("derives status per keyword and groups by client, risk-first", async () => {
    keywordFindManyMock.mockResolvedValue([
      { id: "k1", keyword: "강남 임플란트", guardChannel: "blog", targetRank: 1, client: { id: "cX", name: "X치과" }, snapshots: [{ rank: 1, checkedOn: day("2026-07-12"), channel: "blog" }] },
      { id: "k2", keyword: "강남 교정", guardChannel: "blog", targetRank: 1, client: { id: "cX", name: "X치과" }, snapshots: [{ rank: 3, checkedOn: day("2026-07-12"), channel: "blog" }] },
      { id: "k3", keyword: "역삼 임플란트", guardChannel: "blog", targetRank: 2, client: { id: "cY", name: "Y치과" }, snapshots: [{ rank: null, checkedOn: day("2026-07-12"), channel: "blog" }] },
      { id: "k4", keyword: "신규 키워드", guardChannel: "blog", targetRank: 1, client: { id: "cZ", name: "Z치과" }, snapshots: [] }
    ]);

    const { guaranteeHeatmap } = await import("@/server/repositories/rank-guarantee");
    const data = await guaranteeHeatmap(superAdmin());

    expect(data.totalKeywords).toBe(4);
    expect(data.droppedTotal).toBe(1);
    expect(data.belowTotal).toBe(1);

    // 이탈 있는 Y치과가 맨 위로 정렬.
    expect(data.rows[0].clientName).toBe("Y치과");
    expect(data.rows[0].cells[0].status).toBe("DROPPED");

    const x = data.rows.find((r) => r.clientId === "cX")!;
    expect(x.maintained).toBe(1);
    expect(x.belowTarget).toBe(1);
    expect(x.cells.find((c) => c.keywordId === "k1")!.status).toBe("MAINTAINED");
    expect(x.cells.find((c) => c.keywordId === "k2")!.status).toBe("BELOW_TARGET");

    const z = data.rows.find((r) => r.clientId === "cZ")!;
    expect(z.cells[0].status).toBe("PENDING"); // 스냅샷 없음
  });

  it("scopes to the marketer's own clients", async () => {
    keywordFindManyMock.mockResolvedValue([]);
    const { guaranteeHeatmap } = await import("@/server/repositories/rank-guarantee");
    await guaranteeHeatmap(marketer());

    expect(keywordFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isGuaranteed: true, client: { assignedMarketerId: "mk-1" } }
      })
    );
  });

  it("returns an empty heatmap when there are no guaranteed keywords", async () => {
    keywordFindManyMock.mockResolvedValue([]);
    const { guaranteeHeatmap } = await import("@/server/repositories/rank-guarantee");
    const data = await guaranteeHeatmap(superAdmin());
    expect(data).toEqual({ rows: [], totalKeywords: 0, droppedTotal: 0, belowTotal: 0 });
  });
});
