import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/erp/AppShell";
import { KeepWarm } from "@/components/erp/KeepWarm";
import { getCurrentUser } from "@/server/session";

export default async function ErpLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const user = await getCurrentUser(requestHeaders.get("x-dev-role") ?? cookieStore.get("dev-role")?.value);

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell role={user.role} canAccessSettings={user.canAccessSettings} deniedFeatures={user.deniedFeatures}>
      <KeepWarm />
      {children}
    </AppShell>
  );
}
