// 목표 경로: src/app/api/integrations/google/callback/route.ts
//
// 구글 OAuth 콜백 — 코드 교환 후 refresh token을 암호화해 ChannelConnection에 저장.
// state(암호화)에서 clientId·userId를 복원하고 30분 이내 요청만 수용.
import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/server/integrations/google";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { getDefaultOrgId } from "@/server/org";
import { db } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_TTL_MS = 30 * 60 * 1000;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateRaw = req.nextUrl.searchParams.get("state");
  const fail = (reason: string) => NextResponse.redirect(new URL(`/integrations?error=${reason}`, req.url));

  if (!code || !stateRaw) return fail("google_denied");

  let state: { clientId: string; userId: string; ts: number };
  try {
    const decrypted = decryptSecret(stateRaw);
    if (!decrypted) return fail("google_state");
    state = JSON.parse(decrypted) as typeof state;
  } catch {
    return fail("google_state");
  }
  if (!state.clientId || !state.userId || Date.now() - state.ts > STATE_TTL_MS) return fail("google_state");

  try {
    const tokens = await exchangeGoogleCode(code);
    if (!tokens.refreshToken) return fail("google_no_refresh");

    const orgId = await getDefaultOrgId();
    await db.channelConnection.upsert({
      where: { clientId_provider: { clientId: state.clientId, provider: "GOOGLE" } },
      create: {
        clientId: state.clientId,
        provider: "GOOGLE",
        refreshTokenEnc: encryptSecret(tokens.refreshToken),
        status: "CONNECTED",
        connectedById: state.userId,
        lastError: null,
        orgId
      },
      update: {
        refreshTokenEnc: encryptSecret(tokens.refreshToken),
        status: "CONNECTED",
        connectedById: state.userId,
        lastError: null
      }
    });
    await db.auditLog.create({
      data: {
        actorId: state.userId,
        action: "channelConnection.connect",
        targetType: "ChannelConnection",
        targetId: state.clientId,
        afterState: { provider: "GOOGLE" }
      }
    });
    return NextResponse.redirect(new URL(`/clients/${state.clientId}?google=connected`, req.url));
  } catch (e) {
    console.error("[google/callback] failed", e);
    return fail("google_exchange");
  }
}
