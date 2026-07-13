"use client";

import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesCombined,
  CircleCheck,
  ClipboardList,
  CreditCard,
  FileSignature,
  FileText,
  ImageIcon,
  PenLine,
  Plane,
  Plug,
  ShieldCheck,
  Sparkles,
  Video,
  MessageSquare,
  Radar,
  Search,
  Megaphone,
  LineChart,
  Newspaper,
  Palette,
  Target
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Role } from "@/domain/types";
import { BrandLogo } from "@/components/erp/BrandLogo";
import { ThemeToggle } from "@/components/erp/ThemeToggle";
import { NotificationBell } from "@/components/collab/NotificationBell";
import { CommandPalette } from "@/components/search/CommandPalette";

type ErpRoute =
  | "/dashboard"
  | "/leads"
  | "/clients"
  | "/insights"
  | "/geo"
  | "/magazine"
  | "/contracts"
  | "/work"
  | "/manuscript"
  | "/ai-studio"
  | "/image-studio"
  | "/studio"
  | "/compliance"
  | "/approvals"
  | "/keywords"
  | "/marketing-studio"
  | "/meetings"
  | "/calendar"
  | "/finance"
  | "/leave"
  | "/weekly"
  | "/reports"
  | "/vault"
  | "/integrations"
  | "/settings";

type NavGroup = "운영" | "관리";

export type NavItem = {
  href: ErpRoute;
  label: string;
  roles: Role[];
  icon: LucideIcon;
  group: NavGroup;
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
      href: "/leads",
      label: "영업 리드",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Target,
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
      href: "/insights",
      label: "거래처 인사이트",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: LineChart,
      group: "운영"
    },
    {
      href: "/contracts",
      label: "계약서",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: FileSignature,
      group: "운영"
    },
    {
      href: "/work",
      label: "업무관리",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: ClipboardList,
      group: "운영"
    },
    {
      href: "/manuscript",
      label: "원고 스튜디오",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: PenLine,
      group: "운영"
    },
    {
      href: "/ai-studio",
      label: "AI 마케팅",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Sparkles,
      group: "운영"
    },
    {
      href: "/image-studio",
      label: "이미지 스튜디오",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: ImageIcon,
      group: "운영"
    },
    {
      href: "/studio",
      label: "디자인 스튜디오",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Palette,
      group: "운영"
    },
    {
      href: "/compliance",
      label: "의료법 검수",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: ShieldCheck,
      group: "운영"
    },
    {
      href: "/approvals",
      label: "승인함",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: CircleCheck,
      group: "운영"
    },
    {
      href: "/meetings",
      label: "회의록",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Video,
      group: "운영"
    },
    {
      href: "/keywords",
      label: "검색량 조회",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Search,
      group: "운영"
    },
    {
      href: "/geo",
      label: "GEO 모니터링",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Radar,
      group: "운영"
    },
    {
      href: "/magazine",
      label: "매거진",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Newspaper,
      group: "운영"
    },
    {
      href: "/marketing-studio",
      label: "마케팅 스튜디오",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Megaphone,
      group: "운영"
    },
    {
      href: "/calendar",
      label: "캘린더",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: CalendarDays,
      group: "운영"
    },
    {
      href: "/finance",
      label: "정산/지출",
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
      icon: CreditCard,
      group: "관리"
    },
    {
      href: "/leave",
      label: "연차/휴가",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Plane,
      group: "관리"
    },
    {
      href: "/weekly",
      label: "주간보고",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: CalendarCheck,
      group: "관리"
    },
    {
      href: "/reports",
      label: "보고서",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: FileText,
      group: "관리"
    },
    {
      href: "/vault",
      label: "보관함",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Archive,
      group: "관리"
    },
    {
      href: "/integrations",
      label: "연동",
      roles: [Role.SUPER_ADMIN],
      icon: Plug,
      group: "관리"
    },
    {
      href: "/settings",
      label: "직원/권한",
      roles: [Role.SUPER_ADMIN],
      icon: ShieldCheck,
      group: "관리"
    }
  ];

  return items.filter((item) => {
    // 설정·연동은 최고관리자 전용이되, 승인받은 관리자/담당자에게도 노출.
    if (item.href === "/settings" || item.href === "/integrations") {
      return role === Role.SUPER_ADMIN || canAccessSettings;
    }
    return item.roles.includes(role);
  });
}

const ROLE_LABEL: Record<Role, string> = {
  [Role.SUPER_ADMIN]: "최고관리자",
  [Role.ADMIN]: "관리자",
  [Role.MARKETER]: "담당자"
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "flex items-center gap-3 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white"
          : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-surface hover:text-ink"
      }
    >
      <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.8} />
      <span>{item.label}</span>
    </Link>
  );
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
  const pathname = usePathname() ?? "";
  const items = getNavigationItems(role, canAccessSettings);
  const operate = items.filter((i) => i.group === "운영");
  const manage = items.filter((i) => i.group === "관리");
  const current = items.find((i) => isActive(pathname, i.href));
  const [paletteOpen, setPaletteOpen] = useState(false);

  // 전역 단축키 — ⌘K / Ctrl+K 로 검색 팔레트 토글.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* 데스크톱 화이트 사이드바 (테마 토큰 — 다크 자동 반전) */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-panel px-3.5 py-5 md:flex">
        <div className="px-2 pb-5 pt-1">
          <BrandLogo tone="auto" className="text-[22px]" />
          <p className="mt-1.5 text-[10px] tracking-[0.14em] text-slate-400">MARKETING ERP</p>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {operate.length > 0 ? (
            <>
              <p className="px-2.5 pb-1.5 pt-2 text-[10px] uppercase tracking-[0.12em] text-slate-400">운영</p>
              <div className="grid grid-cols-1 gap-0.5">
                {operate.map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
                ))}
              </div>
            </>
          ) : null}
          {manage.length > 0 ? (
            <>
              <p className="px-2.5 pb-1.5 pt-4 text-[10px] uppercase tracking-[0.12em] text-slate-400">관리</p>
              <div className="grid grid-cols-1 gap-0.5">
                {manage.map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
                ))}
              </div>
            </>
          ) : null}
        </nav>

        <div className="mt-3 flex items-center gap-2.5 border-t border-line px-2 pt-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-strong">
            {ROLE_LABEL[role].charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink">{ROLE_LABEL[role]}</p>
            <p className="text-[10px] text-slate-400">Marketing ERP</p>
          </div>
        </div>
      </aside>

      <main className="min-h-screen md:pl-60">
        <header className="sticky top-0 z-10 border-b border-line bg-panel/95 px-4 py-3.5 backdrop-blur sm:px-6">
          <div className="flex items-center gap-4">
            <div className="min-w-0">
              <h1 className="text-base font-bold text-ink">{current?.label ?? "대시보드"}</h1>
              <p className="mt-0.5 text-xs text-slate-500">역할: {ROLE_LABEL[role]}</p>
            </div>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="ml-auto hidden items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-slate-400 transition hover:text-ink sm:flex"
            >
              <Search className="h-3.5 w-3.5" />
              거래처·업무 검색…
              <kbd className="rounded border border-line px-1 text-[10px] leading-4">⌘K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-2 sm:ml-0">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-slate-500 sm:hidden"
                aria-label="검색"
              >
                <Search className="h-4 w-4" />
              </button>
              <ThemeToggle />
              <NotificationBell />
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-strong">
              {ROLE_LABEL[role].charAt(0)}
            </div>
          </div>

          {/* 모바일 가로 스크롤 네비 */}
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-white"
                      : "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-line bg-card px-3 text-sm text-slate-700"
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </header>

        <div className="p-4 sm:p-6">{children}</div>
      </main>

      <CommandPalette role={role} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
