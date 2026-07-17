import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  CreditCard,
  FileText,
  Inbox,
  Kanban,
  PenLine,
  Plane,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Role } from "@/domain/types";

type ErpRoute =
  | "/dashboard"
  | "/clients"
  | "/clients/pipeline"
  | "/portal-requests"
  | "/work"
  | "/manuscript"
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
  group?: string; // 그룹 구분선용
};

export function getNavigationItems(role: Role, canAccessSettings = false): NavItem[] {
  const items: NavItem[] = [
    {
      href: "/dashboard",
      label: "대시보드",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: ChartNoAxesCombined,
      group: "운영"
    },
    {
      href: "/clients",
      label: "거래처",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: BriefcaseBusiness,
      group: "운영"
    },
    {
      href: "/clients/pipeline",
      label: "영업 파이프라인",
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
      icon: Kanban,
      group: "운영"
    },
    {
      href: "/portal-requests",
      label: "포털 요청",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Inbox,
      group: "운영"
    },
    {
      href: "/work",
      label: "업무관리",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: ClipboardList,
      group: "업무"
    },
    {
      href: "/manuscript",
      label: "원고 스튜디오",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: PenLine,
      group: "업무"
    },
    {
    },
    {
      href: "/reports",
      label: "보고서",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: FileText,
      group: "업무"
    },
    {
      href: "/calendar",
      label: "캘린더",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: CalendarDays,
      group: "일정"
    },
    {
      href: "/leave",
      label: "연차/휴가",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Plane,
      group: "일정"
    },
    {
      href: "/finance",
      label: "정산/지출",
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
      icon: CreditCard,
      group: "재무"
    },
    {
      href: "/settings",
      label: "직원/권한",
      roles: [Role.SUPER_ADMIN],
      icon: ShieldCheck,
      group: "설정"
    }
  ];

  return items.filter((item) => {
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

  // 그룹별로 묶기
  const grouped: { group: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const g = item.group ?? "기타";
    const existing = grouped.find((x) => x.group === g);
    if (existing) {
      existing.items.push(item);
    } else {
      grouped.push({ group: g, items: [item] });
    }
  }

  return (
    <div className="min-h-screen bg-surface text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white px-5 py-6 md:block">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Venom ERP
          </p>
          <h1 className="mt-1 text-base font-bold text-slate-800">운영 셸</h1>
        </div>

        <nav className="mt-6 space-y-4">
          {grouped.map(({ group, items: groupItems }) => (
            <div key={group}>
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {group}
              </p>
              <div className="grid gap-0.5">
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="inline-flex items-center gap-3 rounded-lg px-3 py-2 text-sm
                        text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <main className="min-h-screen md:pl-64">
        <header className="border-b border-line bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Venom Marketing ERP</p>
              <p className="text-xs text-slate-400">
                {role === "SUPER_ADMIN" ? "최고관리자" :
                 role === "ADMIN" ? "관리자" :
                 role === "MARKETER" ? "마케터" : role}
              </p>
            </div>
            {/* 모바일 수평 스크롤 네비 */}
            <nav className="flex gap-1.5 overflow-x-auto pb-1 md:hidden">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg
                      border border-slate-200 bg-white px-3 text-xs text-slate-600"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <div>{children}</div>
      </main>
    </div>
  );
}
