// 원고 스튜디오 엔진 API(/api/generate-*, /api/keywords, /api/wp-draft) 공통 인증.
// 같은 오리진에서 로그인한 ERP 사용자면 통과(세션 쿠키). 외부 엔진처럼 쓸 땐
// ADMIN_SECRET 이 설정된 경우에 한해 Authorization: Bearer <ADMIN_SECRET> 도 허용.
import { createHash, timingSafeEqual } from "node:crypto";
import { getCurrentUser } from "@/server/session";

function timingSafeEqual256(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** 인증되면 true. 로그인 세션 또는 ADMIN_SECRET Bearer. */
export async function hasEngineAccess(req: Request): Promise<boolean> {
  const user = await getCurrentUser().catch(() => null);
  if (user) return true;
  const adminSecret = process.env.ADMIN_SECRET;
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  return Boolean(adminSecret && bearer && timingSafeEqual256(bearer, adminSecret));
}
