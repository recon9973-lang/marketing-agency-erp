// 원고 스튜디오 "워드프레스 발행/예약/임시저장" 백엔드.
// studio.html → POST {siteUrl, user, appPassword, title, html, status, date}
// 응답 { ok, status, editLink }
//
// 워드프레스 REST API(/wp-json/wp/v2/posts) + 애플리케이션 비밀번호(Basic 인증)를 사용한다.
// 자격증명은 사용자가 스튜디오 설정에 입력한 "자기 워드프레스" 값으로, 요청마다 전달된다.
import { NextResponse } from "next/server";

import { hasEngineAccess } from "@/server/http/engine-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fail(error: string, status = 200) {
  return NextResponse.json({ ok: false, error }, { status });
}

const ALLOWED = new Set(["draft", "publish", "future"]);

export async function POST(req: Request) {
  if (!(await hasEngineAccess(req))) {
    return fail("인증이 필요합니다. ERP에 로그인한 상태에서 이용하세요.", 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("요청 형식이 올바르지 않습니다.", 400);
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const siteUrlRaw = str(body.siteUrl);
  const user = str(body.user);
  const appPassword = str(body.appPassword);
  const title = str(body.title);
  const html = typeof body.html === "string" ? body.html : "";
  let status = str(body.status) || "draft";
  const date = str(body.date);

  if (!siteUrlRaw || !user || !appPassword) {
    return fail("워드프레스 주소·아이디·애플리케이션 비밀번호를 입력하세요.", 400);
  }
  if (!title && !html) return fail("발행할 제목/본문이 없습니다.", 400);
  if (!ALLOWED.has(status)) status = "draft";

  // URL 검증 — http(s)만 허용.
  let base: URL;
  try {
    base = new URL(siteUrlRaw);
    if (base.protocol !== "http:" && base.protocol !== "https:") throw new Error("proto");
  } catch {
    return fail("워드프레스 주소 형식이 올바르지 않습니다. (예: https://myblog.com)", 400);
  }
  // 예약(future)인데 날짜가 없으면 임시저장으로 강등.
  if (status === "future" && !date) status = "draft";

  const endpoint = `${base.origin}/wp-json/wp/v2/posts`;
  const authHeader = "Basic " + Buffer.from(`${user}:${appPassword}`).toString("base64");
  const payload: Record<string, unknown> = { title, content: html, status };
  if (status === "future" && date) payload.date = date;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify(payload)
    });
    const data = (await res.json().catch(() => null)) as
      | { id?: number; status?: string; link?: string; message?: string }
      | null;

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return fail("워드프레스 인증 실패. 아이디/애플리케이션 비밀번호를 확인하세요.", 200);
      }
      return fail(data?.message || `워드프레스 오류 (HTTP ${res.status})`, 200);
    }
    if (!data?.id) return fail("워드프레스 응답을 해석하지 못했습니다.", 200);

    const editLink = `${base.origin}/wp-admin/post.php?post=${data.id}&action=edit`;
    return NextResponse.json({ ok: true, status: data.status ?? status, editLink });
  } catch {
    return fail("워드프레스에 연결하지 못했습니다. 주소를 확인하세요.", 200);
  }
}
