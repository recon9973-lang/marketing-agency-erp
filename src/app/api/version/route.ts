// 진단용 — 현재 라이브 배포가 어떤 커밋/코드인지 확인. 값에 비밀 없음.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
    ref: process.env.VERCEL_GIT_COMMIT_REF ?? "unknown",
    hasBootstrapLogin: true, // 이 필드가 보이면 부트스트랩 로그인 코드가 배포된 것
    builtMarker: "auth-bootstrap-43665dd"
  });
}
