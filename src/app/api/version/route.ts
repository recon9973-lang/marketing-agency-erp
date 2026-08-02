import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/changelog";

// 현재 배포의 커밋 SHA — 클라이언트(VersionWatch)가 자기 번들의 SHA와 대조해
// 새 배포를 감지한다. 민감정보가 아니므로 인증 없이 공개.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { sha: process.env.VERCEL_GIT_COMMIT_SHA || "dev", version: APP_VERSION },
    { headers: { "cache-control": "no-store" } }
  );
}
