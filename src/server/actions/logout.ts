"use server";

/**
 * 로그아웃 서버 액션 — 세션 종료 후 로그인 페이지로 이동.
 * 클라이언트(AppShell)의 <form action={logout}>에서 호출한다(next-auth v5).
 */
import { signOut } from "@/server/auth";

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
