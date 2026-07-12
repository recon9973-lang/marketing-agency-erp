import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const updateMock = vi.fn();
const updateManyMock = vi.fn();
const auditCreateMock = vi.fn();
const txMock = {
  contentPlan: { update: updateMock },
  geoQuestion: { updateMany: updateManyMock },
  auditLog: { create: auditCreateMock },
};

vi.mock("@/server/db", () => ({
  db: {
    contentPlan: { findMany: findManyMock },
    $transaction: async (fn: (tx: typeof txMock) => unknown) => fn(txMock),
  },
}));

const wordpressConfiguredMock = vi.fn(() => true);
const wordpressGetPostStatusMock = vi.fn();

vi.mock("@/server/marketing/providers/wordpress", () => ({
  wordpressConfigured: wordpressConfiguredMock,
  wordpressGetPostStatus: wordpressGetPostStatusMock,
}));

async function run() {
  const { runScheduledPublishReconcile } = await import("@/server/jobs/scheduled-publish");
  return runScheduledPublishReconcile();
}

describe("runScheduledPublishReconcile", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    wordpressConfiguredMock.mockReturnValue(true);
  });

  it("WP 미설정이면 스킵한다", async () => {
    wordpressConfiguredMock.mockReturnValue(false);
    const res = await run();
    expect(res).toEqual({ checked: 0, published: 0, failed: 0, skipped: "WORDPRESS_NOT_CONFIGURED" });
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("WP가 publish면 PUBLISHED로 전이하고 GEO 질문을 연결한다", async () => {
    findManyMock.mockResolvedValue([{ id: "p1", clientId: "c1", wpPostId: 101, publishedUrl: null }]);
    wordpressGetPostStatusMock.mockResolvedValue({
      ok: true,
      data: { status: "publish", link: "https://site/final-url" },
    });
    const res = await run();
    expect(res.published).toBe(1);
    expect(res.checked).toBe(1);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1" },
        data: expect.objectContaining({ status: "PUBLISHED", publishedUrl: "https://site/final-url" }),
      }),
    );
    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { answerPlanId: "p1" }, data: { targetPageUrl: "https://site/final-url" } }),
    );
    expect(auditCreateMock).toHaveBeenCalledOnce();
  });

  it("아직 future면 전이하지 않는다", async () => {
    findManyMock.mockResolvedValue([{ id: "p2", clientId: "c1", wpPostId: 102, publishedUrl: "https://site/x" }]);
    wordpressGetPostStatusMock.mockResolvedValue({ ok: true, data: { status: "future", link: "https://site/x" } });
    const res = await run();
    expect(res.published).toBe(0);
    expect(res.checked).toBe(1);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("WP 상태 조회 실패는 failed로 집계하고 상태를 유지한다", async () => {
    findManyMock.mockResolvedValue([{ id: "p3", clientId: "c1", wpPostId: 103, publishedUrl: null }]);
    wordpressGetPostStatusMock.mockResolvedValue({ ok: false, error: { code: "UPSTREAM_ERROR", message: "x" } });
    const res = await run();
    expect(res.failed).toBe(1);
    expect(res.published).toBe(0);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
