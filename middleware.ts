import { NextResponse, type NextRequest } from "next/server";

function isAllowedDevRole(role: string | null) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "MARKETER";
}

export function middleware(request: NextRequest) {
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

export const config = {
  matcher: ["/dashboard", "/leads", "/clients", "/geo", "/work", "/manuscript", "/calendar", "/finance", "/leave", "/reports", "/settings"]
};
