import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/erp/AppShell";
import { getCurrentUser } from "@/server/session";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export default async function ErpLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const user = await getCurrentUser(requestHeaders.get("x-dev-role") ?? cookieStore.get("dev-role")?.value);

  if (!user) {
    // CLIENT 역할 사용자는 포털로 리다이렉트
    const session = await auth();
    if (session?.user?.id) {
      const dbUser = await db.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      if (dbUser?.role === "CLIENT") {
        redirect("/portal/dashboard");
      }
    }
    redirect("/login");
  }

  return (
    <AppShell role={user.role} canAccessSettings={user.canAccessSettings}>
      {children}
    </AppShell>
  );
}
