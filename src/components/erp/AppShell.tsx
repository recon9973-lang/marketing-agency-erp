import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  CreditCard,
  FileText,
  PenLine,
  Plane,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Role } from "@/domain/types";

type ErpRoute =
  | "/dashboard"
  | "/clients"
  | "/work"
  | "/manuscript"
  | "/studio"
  | "/calendar"
  | "/finance"
  | "/leave"
  | "/reports"
  | "/settings";

export type NavItem = {
  href: ErpRoute;
  label: string;
  roles: Role[];
  icon: LucideIcon;
};

export function getNavigationItems(role: Role, canAccessSettings = false): NavItem[] {
  const items: NavItem[] = [
    {
      href: "/dashboard",
      label: "대시보드",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: ChartNoAxesCombined
    },
    {
      href: "/clients",
      label: "거래처",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: BriefcaseBusiness
    },
    {
      href: "/work",
      label: "업무관리",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: ClipboardList
    },
    {
      href: "/manuscript",
      label: "원고 스튜디오",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: PenLine
    },
    {
      href: "/studio",
      label: "마케팅 스튜디오",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Sparkles
    },
    {
      href: "/calendar",
      label: "캘린더",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: CalendarDays
    },
    {
      href: "/finance",
      label: "정산/지출",
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
      icon: CreditCard
    },
    {
      href: "/leave",
      label: "연차/휴가",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Plane
    },
    {
      href: "/reports",
      label: "보고서",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: FileText
    },
    {
      href: "/settings",
      label: "직원/권한",
      roles: [Role.SUPER_ADMIN],
      icon: ShieldCheck
    }
  ];

  return items.filter((item) => {
    // 설정(직원/권한)은 최고관리자 전용이되, 승인받은 관리자/담당자에게도 노출.
    if (item.href === "/settings") {
      return role === Role.SUPER_ADMIN || canAccessSettings;
    }
    return item.roles.includes(role);
  });
}

export function AppShell({
  children,
  role,
  canAccessSettings = false
}: {
  children: ReactNode;
  role: Role;
  canAccessSettings?: boolean;
}) {
  const items = getNavigationItems(role, canAccessSettings);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white px-5 py-6 md:block">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Marketing Agency ERP</p>
          <h1 className="mt-2 text-lg font-semibold">운영 셸</h1>
        </div>
        <nav className="mt-8 grid gap-1">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-700 transition hover:bg-surface hover:text-ink"
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-h-screen md:pl-64">
        <header className="border-b border-line bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Marketing ERP</p>
              <p className="text-sm text-slate-500">역할: {role}</p>
            </div>
            <nav className="flex gap-2 overflow-x-auto pb-1 md:hidden">
              {items.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm text-slate-700"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
