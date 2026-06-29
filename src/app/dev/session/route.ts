import { NextResponse, type NextRequest } from "next/server";

function isAllowedDevRole(role: string | null) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "MARKETER";
}

function getSafeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role");
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));

  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_SESSION !== "true" || !isAllowedDevRole(role)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  process.env.DEV_SESSION_ROLE = role;

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  response.cookies.set("dev-role", role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });

  return response;
}
