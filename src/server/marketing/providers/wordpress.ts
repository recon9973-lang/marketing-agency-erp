// src/server/marketing/providers/wordpress.ts
//
// WordPress.com 발행 provider(브랜드블로그).
//   - 에이전트 경로(1순위): MCP wpcom-mcp-content-authoring (draft → preview → publish).
//   - 서버 경로: WORDPRESS_API_TOKEN + WORDPRESS_SITE(도메인 또는 site id) 설정 시
//       WordPress.com REST v2: POST https://public-api.wordpress.com/wp/v2/sites/{site}/posts
//     미설정 시 CONFIG_MISSING.

import {
  provOk,
  provFail,
  type PublishProvider,
  type PublishInput,
  type PublishOut,
  type ProviderResult,
} from "./types";

function cfg(): { token: string; site: string } | null {
  const token = process.env.WORDPRESS_API_TOKEN;
  const site = process.env.WORDPRESS_SITE;
  if (!token || !site) return null;
  return { token, site };
}

export const wordpressPublish: PublishProvider = {
  async publish(input: PublishInput): Promise<ProviderResult<PublishOut>> {
    const c = cfg();
    if (!c) {
      return provFail(
        "CONFIG_MISSING",
        "WORDPRESS_API_TOKEN/SITE 미설정 — 에이전트 경로(MCP content-authoring)를 사용하세요",
      );
    }
    const scheduled = !!input.scheduledAt && new Date(input.scheduledAt).getTime() > Date.now();
    try {
      const res = await fetch(
        `https://public-api.wordpress.com/wp/v2/sites/${encodeURIComponent(c.site)}/posts`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            title: input.title ?? "",
            content: input.bodyHtmlOrMarkdown,
            status: scheduled ? "future" : "publish",
            ...(scheduled ? { date: new Date(input.scheduledAt!).toISOString() } : {}),
          }),
          cache: "no-store",
        },
      );
      if (res.status === 401 || res.status === 403) return provFail("UNAUTHORIZED", "WordPress 인증 실패");
      if (res.status === 429) return provFail("RATE_LIMITED", "WordPress 호출 한도 초과");
      if (!res.ok) return provFail("UPSTREAM_ERROR", `WordPress ${res.status}`);
      const json = (await res.json()) as { link?: string; URL?: string; id?: number | string; ID?: number | string };
      return provOk(
        {
          status: scheduled ? "SCHEDULED" : "PUBLISHED",
          externalUrl: json.link ?? json.URL,
          externalId: String(json.id ?? json.ID ?? ""),
        },
        { source: "wordpress" },
      );
    } catch (e) {
      return provFail("UPSTREAM_ERROR", "WordPress 발행 실패", e);
    }
  },
};
