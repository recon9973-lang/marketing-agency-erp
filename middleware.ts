import { NextResponse, type NextRequest } from "next/server";

function isAllowedDevRole(role: string | null) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "MARKETER";
}

// 여러 배포 주소(프리뷰 URL·구버전 도메인)로 접속이 흩어져 "다른 기기에서 안 보인다"는
// 혼동을 막기 위한 정규 주소 통합. CANONICAL_HOST 가 설정돼 있으면, 그 주소가 아닌
// 호스트로 들어온 요청을 항상 그 주소로 308 리다이렉트한다.
// 미설정 시 완전 무동작(안전) — 로컬 개발/프리뷰는 그대로 동작한다.
function canonicalRedirect(request: NextRequest): NextResponse | null {
  const canonical = process.env.CANONICAL_HOST?.trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (!canonical) return null;

  const host = request.headers.get("host");
  if (!host) return null;
  // 로컬 개발 주소는 통합 대상에서 제외.
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return null;
  if (host === canonical) return null; // 이미 정규 주소

  const url = request.nextUrl.clone();
  url.host = canonical;
  url.protocol = "https:";
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export function middleware(request: NextRequest) {
  const redirect = canonicalRedirect(request);
  if (redirect) return redirect;

  const devRole = request.nextUrl.searchParams.get("devRole");

  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_SESSION !== "true" || !isAllowedDevRole(devRole)) {
    return NextResponse.next();
  }

  process.env.DEV_SESSION_ROLE = devRole;

  const nextUrl = request.nextUrl.clone();
  nextUrl.searchParams.delete("devRole");
  const response = NextResponse.redirect(nextUrl);
  response.cookies.set("dev-role", devRole, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });

  return response;
}

// 정규 주소 통합은 앱 전 경로에 적용해야 하므로 매처를 넓힌다.
// 단, 정적 자산(_next, 확장자 있는 파일)과 API(크론 등 배포 URL 직접 호출)는 제외한다.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\.).*)"]
};
