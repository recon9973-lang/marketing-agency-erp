// src/server/marketing/providers/instagram-multi.ts
//
// 인스타 관리 — 계정 지정 발행(단일/캐러셀). 계정별 token·igId·version을 받아 발행한다.
// 토큰은 InstagramAccount.tokenRef(환경변수 이름)로 조회 — DB에 원문 저장하지 않음.
// image_url 은 공개 접근 가능한 JPEG/PNG여야 한다(인스타 서버가 직접 가져감).
import { provOk, provFail, type ProviderResult } from "./types";

export type IgTarget = { token: string; igId: string; version: string };
export type IgPublishOut = { id: string; permalink?: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** tokenRef(환경변수 이름)로 토큰을 읽어 계정 타깃을 만든다. 미설정 시 null. */
export function resolveTarget(a: { igBusinessId: string; tokenRef: string; graphVersion?: string | null }): IgTarget | null {
  const token = process.env[a.tokenRef]?.trim();
  if (!token || !a.igBusinessId) return null;
  const raw = (a.graphVersion || "v21.0").trim();
  const version = /^v\d+\.\d+$/.test(raw) ? raw : "v21.0";
  return { token, igId: a.igBusinessId, version };
}

async function graphPost(url: string, body: URLSearchParams): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST", body, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}
async function graphGet(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { cache: "no-store" });
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

function mapErr(status: number, json: unknown): ReturnType<typeof provFail> {
  const err = (json as { error?: { code?: number; message?: string } })?.error;
  const code = err?.code;
  const msg = err?.message || `Instagram ${status}`;
  if (code === 190 || status === 401) return provFail("UNAUTHORIZED", "인스타 토큰이 만료/무효합니다 — 토큰을 재발급하세요", json);
  if (code === 4 || code === 17 || code === 32 || status === 429) return provFail("RATE_LIMITED", "인스타 호출 한도 초과", json);
  if (code === 100 || code === 36003) return provFail("INVALID_INPUT", `인스타 요청 오류: ${msg}`, json);
  return provFail("UPSTREAM_ERROR", `인스타 발행 실패: ${msg}`, json);
}

async function waitFinished(base: string, id: string, token: string): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const st = await graphGet(`${base}/${id}?fields=status_code&access_token=${encodeURIComponent(token)}`);
    if (st.status_code === "FINISHED") return;
    if (st.status_code === "ERROR") throw new Error("container ERROR");
    await wait(2500);
  }
}

/**
 * 계정에 이미지 1~10장 발행. 2장 이상이면 캐러셀(자식 컨테이너→CAROUSEL→media_publish).
 * images: 공개 URL 배열, caption: 완성 문자열.
 */
export async function publishToAccount(target: IgTarget, images: string[], caption: string): Promise<ProviderResult<IgPublishOut>> {
  const urls = images.filter((u) => /^https?:\/\//.test(u)).slice(0, 10);
  if (urls.length === 0) return provFail("INVALID_INPUT", "발행할 공개 이미지 URL이 없습니다");
  const base = `https://graph.facebook.com/${target.version}`;
  const tok = encodeURIComponent(target.token);

  try {
    let creationId: string;
    if (urls.length === 1) {
      const f = new URLSearchParams({ image_url: urls[0], caption, access_token: target.token });
      const r = await graphPost(`${base}/${target.igId}/media`, f);
      if (!r.ok || !r.json.id) return mapErr(r.status, r.json);
      creationId = String(r.json.id);
    } else {
      const childIds: string[] = [];
      for (const u of urls) {
        const cf = new URLSearchParams({ image_url: u, is_carousel_item: "true", access_token: target.token });
        const cr = await graphPost(`${base}/${target.igId}/media`, cf);
        if (!cr.ok || !cr.json.id) return mapErr(cr.status, cr.json);
        childIds.push(String(cr.json.id));
      }
      await Promise.all(childIds.map((id) => waitFinished(base, id, target.token)));
      const pf = new URLSearchParams({ media_type: "CAROUSEL", children: childIds.join(","), caption, access_token: target.token });
      const pr = await graphPost(`${base}/${target.igId}/media`, pf);
      if (!pr.ok || !pr.json.id) return mapErr(pr.status, pr.json);
      creationId = String(pr.json.id);
    }

    await waitFinished(base, creationId, target.token);
    const pub = await graphPost(`${base}/${target.igId}/media_publish`, new URLSearchParams({ creation_id: creationId, access_token: target.token }));
    if (!pub.ok || !pub.json.id) return mapErr(pub.status, pub.json);
    const mediaId = String(pub.json.id);
    const perm = await graphGet(`${base}/${mediaId}?fields=permalink&access_token=${tok}`);
    return provOk({ id: mediaId, permalink: typeof perm.permalink === "string" ? perm.permalink : undefined }, { source: "instagram" });
  } catch (e) {
    return provFail("UPSTREAM_ERROR", `인스타 발행 예외: ${e instanceof Error ? e.message : String(e)}`);
  }
}
