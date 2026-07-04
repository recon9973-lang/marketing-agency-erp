// src/server/marketing/providers/make.ts
//
// Make(구 Integromat) 오케스트레이션 발행 provider.
// 공식 발행 API가 제한적인 채널(네이버 블로그/인스타그램/플레이스)은 Make 시나리오로 위임한다.
// MAKE_WEBHOOK_URL로 페이로드를 보내고 실제 로그인/발행은 Make 시나리오가 처리한다.
//
// 보안: 채널 자격증명(아이디/비밀번호)은 Make의 암호화 커넥션 저장소에 두고,
// 여기서는 계정 참조(라벨/식별자)만 전달한다. 평문 자격증명을 웹훅 본문에 넣지 않는다.

import {
  provOk,
  provFail,
  type PublishProvider,
  type PublishInput,
  type PublishOut,
  type ProviderResult,
} from "./types";

export const makePublish: PublishProvider = {
  async publish(input: PublishInput): Promise<ProviderResult<PublishOut>> {
    const url = process.env.MAKE_WEBHOOK_URL;
    if (!url) return provFail("CONFIG_MISSING", "MAKE_WEBHOOK_URL 미설정");
    const started = Date.now();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: input.channel,
          title: input.title ?? "",
          body: input.bodyHtmlOrMarkdown,
          scheduledAt: input.scheduledAt ?? null,
          accountRef: input.channelAccountRef ?? null, // 라벨/식별자만(평문 자격증명 금지)
          mediaUrls: input.mediaUrls ?? [],
        }),
        cache: "no-store",
      });
      if (!res.ok) return provFail("UPSTREAM_ERROR", `Make ${res.status}`);
      const scheduled = !!input.scheduledAt && new Date(input.scheduledAt).getTime() > Date.now();
      return provOk({ status: scheduled ? "SCHEDULED" : "PUBLISHED" }, { source: "make", elapsedMs: Date.now() - started });
    } catch (e) {
      return provFail("UPSTREAM_ERROR", "Make 트리거 실패", e);
    }
  },
};
