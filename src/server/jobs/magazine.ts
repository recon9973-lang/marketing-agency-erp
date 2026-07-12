// 목표 경로: src/server/jobs/magazine.ts
//
// 매거진 자동 초안 잡(크론) — 큐(QUEUED) 상위 N건을 AI 초안(DRAFTED)으로 생성.
// 안전 램프업: 하루 N건만(기본 2, MAGAZINE_DAILY_DRAFTS로 조정, 상한 5).
// 발행(PUBLISHED)은 사람 검토 후에만 — 크론은 초안까지만 만든다(대량발행 남용 방지).
import { buildMagazineMarkdown } from "@/domain/content/magazine";
import { generateMagazineDraft, isAiConfigured } from "@/server/ai/claude";
import { db } from "@/server/db";

export type MagazineAutoDraftResult = { drafted: number; failed: number; skipped?: string };

export async function runMagazineAutoDraft(): Promise<MagazineAutoDraftResult> {
  if (!isAiConfigured()) return { drafted: 0, failed: 0, skipped: "AI_NOT_CONFIGURED" };

  const raw = Number(process.env.MAGAZINE_DAILY_DRAFTS ?? 2);
  const limit = Math.max(1, Math.min(5, Number.isFinite(raw) ? Math.round(raw) : 2));

  const queued = await db.magazinePost.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, title: true, category: true, kind: true, seed: true }
  });

  let drafted = 0;
  let failed = 0;
  for (const post of queued) {
    try {
      const draft = await generateMagazineDraft({ title: post.title, kind: post.kind, category: post.category, seed: post.seed });
      if (!draft.summary && draft.sections.length === 0) throw new Error("AI_EMPTY");
      const markdown = buildMagazineMarkdown(draft);
      await db.magazinePost.update({ where: { id: post.id }, data: { draft: markdown, status: "DRAFTED" } });
      await db.auditLog.create({
        data: { actorId: null, action: "magazine.autodraft", targetType: "MagazinePost", targetId: post.id }
      });
      drafted++;
    } catch (e) {
      console.error("[magazine autodraft] failed", post.id, e);
      failed++; // 개별 실패 격리 — 나머지 계속
    }
  }
  return { drafted, failed };
}
