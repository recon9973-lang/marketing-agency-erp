import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/session";

// 직원 세션 필수 — 외부인이 API 쿼터(검색광고·OpenAI·오픈API)를 소모하지 못하게 차단
export async function requireStaff(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const user = await getCurrentUser(cookieStore.get("dev-role")?.value);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
