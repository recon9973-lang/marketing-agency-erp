import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/erp/AppShell";
import { getCurrentUser } from "@/server/session";

export default async function ErpLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <AppShell role={user.role}>{children}</AppShell>;
}
