// src/server/marketing/providers/instagram.ts
//
// Instagram 자동 발행 provider — Instagram Graph API(Facebook Graph) 방식.
//   env: INSTAGRAM_ACCESS_TOKEN(장기 페이지 토큰), INSTAGRAM_BUSINESS_ID(IG 비즈니스 계정 ID),
//        INSTAGRAM_GRAPH_VERSION(선택, 기본 v21.0)
//   → 2단계 발행: (1) /{ig-id}/media 로 미디어 컨테이너 생성 → (2) /{ig-id}/media_publish 로 발행.
//   미설정 시 CONFIG_MISSING → 호출부가 "인스타 미설정" 안내로 우회한다.
//
// 사전 준비(사용자): 인스타 비즈니스/크리에이터 계정 → 페이스북 페이지 연결 → Meta 앱에서
//   instagram_basic·instagram_content_publish 권한 → 장기 토큰 발급. (설정 가이드 별도 제공)
//
// 제약: image_url 은 공개 접근 가능한 JPEG/PNG URL 이어야 한다(인스타 서버가 직접 가져감).
//   비율 1:1~1.91:1(가로) 또는 4:5(세로) 권장. 캡션 ≤2200자, 해시태그 ≤30개.

import { provOk, provFail, type ProviderResult } from "./types";

type IgConfig = { token: string; igId: string; version: string };

/** env 확인 + 그래프 API 버전 정규화. 하나라도 없으면 null. */
function cfg(): IgConfig | null {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const igId = process.env.INSTAGRAM_BUSINESS_ID?.trim();
  if (!token || !igId) return null;
  const raw = process.env.INSTAGRAM_GRAPH_VERSION?.trim() || "v21.0";
  const version = /^v\d+\.\d+$/.test(raw) ? raw : "v21.0";
  return { token, igId, version };
}

/** UI가 "인스타 자동 발행" 노출 여부를 판단하는 데 사용(토큰은 노출하지 않음). */
export function instagramConfigured(): boolean {
  return cfg() !== null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 그래프 API 에러 → provider 에러코드 매핑. */
function mapGraphError(status: number, body: unknown): ReturnType<typeof provFail> {
  const err = (body as { error?: { code?: number; error_subcode?: number; message?: string } })?.error;
  const code = err?.code;
  const msg = err?.message || `Instagram ${status}`;
  if (code === 190 || status === 401) return provFail("UNAUTHORIZED", "인스타 토큰이 만료/무효합니다 — 토큰을 재발급하세요", body);
  if (code === 4 || code === 17 || code === 32 || code === 613 || status === 429) return provFail("RATE_LIMITED", "인스타 호출 한도 초과", body);
  if (code === 100) return provFail("INVALID_INPUT", `인스타 요청 오류: ${msg}`, body);
  return provFail("UPSTREAM_ERROR", `인스타 발행 실패: ${msg}`, body);
}

async function graphPost(url: string): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; status: number; json: unknown }> {
  const res = await fetch(url, { method: "POST", cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) return { ok: false, status: res.status, json };
  return { ok: true, json };
}

export type InstagramPublishOut = { id: string; permalink?: string };

/**
 * 이미지 1장 피드 발행. imageUrl 은 공개 URL, caption 은 완성된 문자열.
 * (1) 컨테이너 생성 → (2) 상태 확인(이미지는 보통 즉시 FINISHED) → (3) 발행 → (4) 퍼머링크 조회.
 */
export async function instagramPublishImage(input: { imageUrl: string; caption: string }): Promise<ProviderResult<InstagramPublishOut>> {
  const c = cfg();
  if (!c) return provFail("CONFIG_MISSING", "INSTAGRAM_ACCESS_TOKEN/BUSINESS_ID 미설정 — 인스타 토큰을 발급해 환경변수를 설정하세요");

  if (!/^https:\/\//.test(input.imageUrl)) return provFail("INVALID_INPUT", "이미지 URL은 https 공개 주소여야 합니다");
  const caption = input.caption.slice(0, 2200);
  const base = `https://graph.facebook.com/${c.version}`;

  try {
    // (1) 컨테이너 생성
    const createUrl =
      `${base}/${c.igId}/media?image_url=${encodeURIComponent(input.imageUrl)}` +
      `&caption=${encodeURIComponent(caption)}&access_token=${encodeURIComponent(c.token)}`;
    const created = await graphPost(createUrl);
    if (!created.ok) return mapGraphError(created.status, created.json);
    const containerId = String(created.json.id ?? "");
    if (!containerId) return provFail("UPSTREAM_ERROR", "컨테이너 생성 응답 해석 실패", created.json);

    // (2) 컨테이너 준비 대기 — 이미지는 보통 즉시, 최대 3회 짧게 폴링
    for (let i = 0; i < 3; i++) {
      const statusRes = await fetch(
        `${base}/${containerId}?fields=status_code&access_token=${encodeURIComponent(c.token)}`,
        { cache: "no-store" },
      );
      const statusJson = (await statusRes.json().catch(() => ({}))) as { status_code?: string };
      if (statusJson.status_code === "FINISHED") break;
      if (statusJson.status_code === "ERROR") return provFail("UPSTREAM_ERROR", "인스타가 이미지를 처리하지 못했습니다(이미지 URL/형식 확인)", statusJson);
      await wait(1500);
    }

    // (3) 발행
    const publishUrl = `${base}/${c.igId}/media_publish?creation_id=${encodeURIComponent(containerId)}&access_token=${encodeURIComponent(c.token)}`;
    const published = await graphPost(publishUrl);
    if (!published.ok) return mapGraphError(published.status, published.json);
    const mediaId = String(published.json.id ?? "");
    if (!mediaId) return provFail("UPSTREAM_ERROR", "발행 응답 해석 실패", published.json);

    // (4) 퍼머링크 조회(실패해도 발행은 성공 — best-effort)
    let permalink: string | undefined;
    try {
      const permRes = await fetch(`${base}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(c.token)}`, { cache: "no-store" });
      const permJson = (await permRes.json().catch(() => ({}))) as { permalink?: string };
      permalink = permJson.permalink;
    } catch {
      /* 무시 */
    }

    return provOk({ id: mediaId, permalink }, { source: "instagram" });
  } catch (e) {
    return provFail("UPSTREAM_ERROR", "인스타 발행 실패 — 네트워크/토큰을 확인하세요", e);
  }
}
