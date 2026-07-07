// src/server/marketing/publish.ts
//
// S5 · 발행 오케스트레이션.
// 흐름: 컴플라이언스·스테이지 게이트(canPublish) → 채널별 provider 라우팅 → 결과.
//
// 게이트: 의료광고법 BLOCK/미검수(PENDING) 콘텐츠는 발행하지 않는다(canPublish).
// 보안: 채널 계정은 '참조(라벨)'만 확인하고, 평문 자격증명은 서버 밖으로 내보내지 않는다.
//       (직접 로그인 발행이 필요한 채널은 Make 암호화 커넥션에 자격증명을 둔다.)
//
// PublishJob 모델은 아직 미마이그레이션 → 결과를 구조화 반환(호출부/UI가 PublishJob으로 저장).

import { canPublish, type PipelineStage, type ComplianceVerdict, type PublishChannel } from "@/domain/marketing/schemas";
import { db } from "@/server/db";
import { wordpressPublish } from "./providers/wordpress";
import { makePublish } from "./providers/make";
import type { PublishInput, PublishOut, ProviderResult } from "./providers/types";

export type PublishRequest = {
  channel: PublishChannel;
  title?: string;
  bodyHtmlOrMarkdown: string;
  scheduledAt?: string;
  clientAccountId?: string;
  mediaUrls?: string[];
  // 발행 게이트 입력
  stage: PipelineStage;
  complianceVerdict: ComplianceVerdict;
};

export type PublishResult = { ok: boolean; data?: PublishOut; error?: string };

export async function publishContent(req: PublishRequest): Promise<PublishResult> {
  // 1) 컴플라이언스·스테이지 게이트
  if (!canPublish(req.stage, req.complianceVerdict)) {
    return { ok: false, error: "PUBLISH_BLOCKED" };
  }

  // 2) 채널 계정 참조 확인(평문 자격증명은 다루지 않는다)
  let channelAccountRef: string | undefined;
  if (req.clientAccountId) {
    const acct = await db.clientAccount.findUnique({
      where: { id: req.clientAccountId },
      select: { id: true, label: true, isActive: true },
    });
    if (!acct) return { ok: false, error: "ACCOUNT_NOT_FOUND" };
    if (!acct.isActive) return { ok: false, error: "ACCOUNT_INACTIVE" };
    channelAccountRef = acct.label;
  }

  // 3) 채널별 provider 라우팅
  const input: PublishInput = {
    channel: req.channel,
    title: req.title,
    bodyHtmlOrMarkdown: req.bodyHtmlOrMarkdown,
    scheduledAt: req.scheduledAt,
    channelAccountRef,
    mediaUrls: req.mediaUrls,
  };

  const res: ProviderResult<PublishOut> =
    req.channel === "WORDPRESS" ? await wordpressPublish.publish(input) : await makePublish.publish(input);

  if (!res.ok) return { ok: false, error: res.error.code };
  return { ok: true, data: res.data };
}
