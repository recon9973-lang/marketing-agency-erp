// src/server/jobs/scheduled-publish.ts
//
// 예약발행 리컨실 — WP에 status:"future"로 예약된 ContentPlan이 실제 게시(publish)되면
// ERP 상태를 SCHEDULED → PUBLISHED로 전이하고, publishedUrl 확정 + GEO 질문 대응 페이지 연결.
// WP가 예약 타이머를 갖고 있어 ERP는 폴링으로만 확인할 수 있다(크론 하루 1회, 멱등).
//
// 대상: status="SCHEDULED" 이고 wpPostId가 있는 ContentPlan.
// 개별 오류는 해당 건만 실패로 격리(전체 중단 없음).

import { db } from "@/server/db";
import { wordpressConfigured, wordpressGetPostStatus } from "@/server/marketing/providers/wordpress";

export type ScheduledPublishResult = { checked: number; published: number; failed: number; skipped?: string };

export async function runScheduledPublishReconcile(): Promise<ScheduledPublishResult> {
  if (!wordpressConfigured()) return { checked: 0, published: 0, failed: 0, skipped: "WORDPRESS_NOT_CONFIGURED" };

  const pending = await db.contentPlan.findMany({
    where: { status: "SCHEDULED", wpPostId: { not: null } },
    select: { id: true, clientId: true, wpPostId: true, publishedUrl: true }
  });

  const result: ScheduledPublishResult = { checked: pending.length, published: 0, failed: 0 };

  for (const plan of pending) {
    try {
      const status = await wordpressGetPostStatus(plan.wpPostId as number);
      if (!status.ok) {
        // 글이 사라졌으면(삭제/오류) 실패로만 집계 — 상태는 유지(다음 회차 재시도)
        result.failed++;
        continue;
      }
      if (status.data.status !== "publish") {
        // 아직 future(예약 대기) — 다음 회차에 다시 확인
        continue;
      }

      const finalUrl = status.data.link ?? plan.publishedUrl ?? null;
      await db.$transaction(async (tx) => {
        await tx.contentPlan.update({
          where: { id: plan.id },
          data: { status: "PUBLISHED", ...(finalUrl ? { publishedUrl: finalUrl } : {}) }
        });
        // 즉시 게시 훅과 동일: GEO 답변 페이지였다면 질문의 대응 페이지 URL 자동 채움
        if (finalUrl) {
          await tx.geoQuestion.updateMany({ where: { answerPlanId: plan.id }, data: { targetPageUrl: finalUrl } });
        }
        await tx.auditLog.create({
          data: {
            actorId: null,
            action: "contentPlan.scheduledPublishReconcile",
            targetType: "ContentPlan",
            targetId: plan.id,
            afterState: { status: "PUBLISHED", publishedUrl: finalUrl ?? undefined }
          }
        });
      });
      result.published++;
    } catch (e) {
      console.error("[scheduled-publish] reconcile failed", plan.id, e);
      result.failed++;
    }
  }

  return result;
}
