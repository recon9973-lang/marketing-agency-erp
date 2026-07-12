// src/server/marketing/providers/wordpress.ts
//
// WordPress 발행 provider — 애플리케이션 비밀번호(Basic 인증) 방식.
//   env: WORDPRESS_SITE_URL(예: https://seokorea.org), WORDPRESS_USER, WORDPRESS_APP_PASSWORD
//   → 대상 사이트의 REST API POST {siteUrl}/wp-json/wp/v2/posts 로 발행.
//   미설정 시 CONFIG_MISSING → 호출부가 "URL 직접 입력" 경로로 우회한다.
//
// 애플리케이션 비밀번호는 wp-admin(사용자 → 프로필 → 애플리케이션 비밀번호)에서 30초 발급.
// OAuth·개발자 앱이 필요 없어 담당자가 직접 연결할 수 있다.

import {
  provOk,
  provFail,
  type PublishProvider,
  type PublishInput,
  type PublishOut,
  type ProviderResult,
} from "./types";

type WpConfig = { origin: string; user: string; appPassword: string };

/** env 3종 확인 + 사이트 URL 정규화(프로토콜 없으면 https 보강). 하나라도 없으면 null. */
function cfg(): WpConfig | null {
  const rawSite = process.env.WORDPRESS_SITE_URL?.trim();
  const user = process.env.WORDPRESS_USER?.trim();
  const appPassword = process.env.WORDPRESS_APP_PASSWORD?.trim();
  if (!rawSite || !user || !appPassword) return null;
  try {
    const url = new URL(/^https?:\/\//.test(rawSite) ? rawSite : `https://${rawSite}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return { origin: url.origin, user, appPassword };
  } catch {
    return null;
  }
}

/** UI가 "워드프레스 자동 게시" 버튼 노출 여부를 판단하는 데 사용(자격증명은 노출하지 않음). */
export function wordpressConfigured(): boolean {
  return cfg() !== null;
}

export const wordpressPublish: PublishProvider = {
  async publish(input: PublishInput): Promise<ProviderResult<PublishOut>> {
    const c = cfg();
    if (!c) {
      return provFail(
        "CONFIG_MISSING",
        "WORDPRESS_SITE_URL/USER/APP_PASSWORD 미설정 — 앱 비밀번호를 발급해 환경변수를 설정하세요",
      );
    }
    const scheduled = !!input.scheduledAt && new Date(input.scheduledAt).getTime() > Date.now();
    const authHeader = "Basic " + Buffer.from(`${c.user}:${c.appPassword}`).toString("base64");
    try {
      const res = await fetch(`${c.origin}/wp-json/wp/v2/posts`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: input.title ?? "",
          content: input.bodyHtmlOrMarkdown,
          status: scheduled ? "future" : "publish",
          ...(scheduled ? { date: new Date(input.scheduledAt!).toISOString() } : {}),
        }),
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) return provFail("UNAUTHORIZED", "WordPress 인증 실패 — 아이디/앱 비밀번호를 확인하세요");
      if (res.status === 429) return provFail("RATE_LIMITED", "WordPress 호출 한도 초과");
      if (!res.ok) return provFail("UPSTREAM_ERROR", `WordPress ${res.status}`);
      const json = (await res.json()) as { link?: string; id?: number | string };
      return provOk(
        {
          status: scheduled ? "SCHEDULED" : "PUBLISHED",
          externalUrl: json.link,
          externalId: String(json.id ?? ""),
        },
        { source: "wordpress" },
      );
    } catch (e) {
      return provFail("UPSTREAM_ERROR", "WordPress 발행 실패 — 사이트 주소를 확인하세요", e);
    }
  },
};
