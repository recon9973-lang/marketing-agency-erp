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
  Lightbulb,
  Link2,
  PenLine,
  Plug,
  ShieldCheck,
  KeyRound,
  Video,
  MessageSquare,
  Radar,
  Search,
  LineChart,
  Newspaper,
  Palette,
  Target,
  Star,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { toggleUserFavorite } from "@/server/actions/favorites";
import type { FavoriteRow } from "@/server/repositories/user-favorite";
import { Role } from "@/domain/types";
import { canUseFeature, CONTROLLABLE_FEATURES, type FeatureKey } from "@/domain/features";
import { BrandLogo } from "@/components/erp/BrandLogo";
import { ThemeToggle } from "@/components/erp/ThemeToggle";
import { NotificationBell } from "@/components/collab/NotificationBell";
import { CommandPalette } from "@/components/search/CommandPalette";
import { ErpSearch } from "@/components/search/ErpSearch";

type ErpRoute =
  | "/dashboard"
  | "/chat"
  | "/leads"
  | "/clients"
  | "/insights"
  | "/seo"
  | "/geo"
  | "/geo-studio"
  | "/geo-scan"
  | "/geo-cep"
  | "/geo-path"
  | "/geo-planner"
  | "/geo-learning"
  | "/geo-content"
  | "/magazine"
  | "/contracts"
  | "/work"
  | "/worklog"
  | "/manuscript"
  | "/ai-studio"
  | "/image-studio"
  | "/studio"
  | "/compliance"
  | "/ideas"
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
  | "/settings"
  | "/account";

// 업무 흐름 기반 그룹 — 컨설팅·계약 → 분석·GEO → 제작 → 보고 → 관리.
type NavGroup = "홈" | "영업·계약" | "분석·GEO" | "제작" | "보고·결재" | "관리";

// 사이드바 섹션 렌더 순서(홈은 상단 고정이라 제외).
const NAV_SECTIONS: NavGroup[] = ["영업·계약", "분석·GEO", "제작", "보고·결재", "관리"];

export type NavItem = {
  href: ErpRoute;
  label: string;
  roles: Role[];
  icon: LucideIcon;
  group: NavGroup;
};

// 기능 제어 대상 메뉴의 href → 기능 키. 차단된 사용자에게는 사이드바에서 숨긴다.
const HREF_TO_FEATURE = new Map<string, FeatureKey>(CONTROLLABLE_FEATURES.map((f) => [f.href, f.key]));

export function getNavigationItems(role: Role, canAccessSettings = false, deniedFeatures: FeatureKey[] = []): NavItem[] {
  const items: NavItem[] = [
    // 홈(상단 고정)
    {
      href: "/dashboard",
      label: "대시보드",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: ChartNoAxesCombined,
      group: "홈"
    },
    {
      href: "/chat",
      label: "채팅",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: MessageSquare,
      group: "홈"
    },
    // ── 영업·계약: 컨설팅(리드/무료진단) → 계약 → 담당자 배정(거래처) ──
    {
      href: "/leads",
      label: "영업 리드",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Target,
      group: "영업·계약"
    },
    {
      href: "/contracts",
      label: "계약서",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: FileSignature,
      group: "영업·계약"
    },
    {
      href: "/clients",
      label: "거래처",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: BriefcaseBusiness,
      group: "영업·계약"
    },
    // ── 분석·GEO: 상세분석(인사이트·검색량·GEO) → 업무계획(업무관리·캘린더) ──
    {
      href: "/insights",
      label: "거래처 인사이트",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: LineChart,
      group: "분석·GEO"
    },
    {
      href: "/keywords",
      label: "검색량 조회",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Search,
      group: "분석·GEO"
    },
    {
      href: "/seo",
      label: "SEO 진단",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Search,
      group: "분석·GEO"
    },
    {
      href: "/geo",
      label: "GEO",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Radar,
      group: "분석·GEO"
    },
    {
      href: "/work",
      label: "업무관리",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: ClipboardList,
      group: "분석·GEO"
    },
    {
      href: "/worklog",
      label: "업무 보고",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Link2,
      group: "분석·GEO"
    },
    {
      href: "/calendar",
      label: "캘린더",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: CalendarDays,
      group: "분석·GEO"
    },
    // ── 제작: 원고·이미지·디자인·AI·마케팅·매거진 → 의료법 검수 → 승인(발행) ──
    {
      href: "/manuscript",
      label: "원고 스튜디오",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: PenLine,
      group: "제작"
    },
    {
      href: "/studio",
      label: "스튜디오",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Palette,
      group: "제작"
    },
    {
      href: "/magazine",
      label: "매거진",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Newspaper,
      group: "제작"
    },
    {
      href: "/compliance",
      label: "의료법 검수",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: ShieldCheck,
      group: "제작"
    },
    {
      href: "/ideas",
      label: "아이디어",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Lightbulb,
      group: "제작"
    },
    {
      href: "/approvals",
      label: "승인함",
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
      icon: CircleCheck,
      group: "보고·결재"
    },
    // ── 보고·결재: 월간 보고서 → 주간보고 → 회의록 → 보관함 ──
    {
      href: "/reports",
      label: "결재",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: FileText,
      group: "보고·결재"
    },
    {
      href: "/weekly",
      label: "주간보고",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: CalendarCheck,
      group: "보고·결재"
    },
    {
      href: "/meetings",
      label: "회의록",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Video,
      group: "보고·결재"
    },
    {
      href: "/vault",
      label: "보관함",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: Archive,
      group: "보고·결재"
    },
    // ── 관리(관리자): 입출금(정산/지출) → 연동 → 인사관리 ──
    // 연차/휴가는 결재(/reports?doc=leave) 내부 탭으로 이동.
    {
      href: "/finance",
      label: "정산/지출",
      roles: [Role.SUPER_ADMIN, Role.ADMIN],
      icon: CreditCard,
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
      label: "인사관리",
      roles: [Role.SUPER_ADMIN],
      icon: ShieldCheck,
      group: "관리"
    },
    {
      href: "/account",
      label: "계정·비밀번호",
      roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER],
      icon: KeyRound,
      group: "관리"
    }
  ];

  return items.filter((item) => {
    // 기능 단위 차단 — 사용자별로 막힌 메뉴는 숨김(최고관리자는 canUseFeature에서 항상 통과).
    const featureKey = HREF_TO_FEATURE.get(item.href);
    if (featureKey && !canUseFeature(role, deniedFeatures, featureKey)) return false;
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

function NavLink({
  item,
  active,
  collapsed,
  favorited,
  onToggleFav,
  favPending
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  favorited: boolean;
  onToggleFav: (item: NavItem) => void;
  favPending: boolean;
}) {
  const Icon = item.icon;
  return (
    <div className="group/nav relative flex items-center">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
        className={`flex flex-1 items-center gap-3 rounded-lg py-2 text-sm transition ${collapsed ? "justify-center px-2" : "px-3"} ${
          active ? "bg-brand font-semibold text-white" : "text-slate-600 hover:bg-surface hover:text-ink"
        }`}
      >
        <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.8} />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      </Link>
      {!collapsed && (
        <button
          type="button"
          onClick={() => onToggleFav(item)}
          disabled={favPending}
          aria-label={favorited ? "즐겨찾기 해제" : "즐겨찾기 추가"}
          title={favorited ? "즐겨찾기 해제" : "즐겨찾기 추가"}
          className={`absolute right-1.5 rounded p-1 transition ${
            favorited ? "opacity-100" : "opacity-0 group-hover/nav:opacity-100"
          } ${active ? "text-white/80 hover:text-white" : "text-slate-300 hover:text-amber-500"}`}
        >
          <Star className={`h-3.5 w-3.5 ${favorited ? "fill-amber-400 text-amber-400" : ""}`} />
        </button>
      )}
    </div>
  );
}

export function AppShell({
  children,
  role,
  canAccessSettings = false,
  deniedFeatures = [],
  favorites = []
}: {
  children: ReactNode;
  role: Role;
  canAccessSettings?: boolean;
  deniedFeatures?: FeatureKey[];
  favorites?: FavoriteRow[];
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const items = getNavigationItems(role, canAccessSettings, deniedFeatures);
  const home = items.find((i) => i.group === "홈");
  const current = items.find((i) => isActive(pathname, i.href));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [favPending, startFav] = useTransition();

  const favHrefs = new Set(favorites.map((f) => f.href));
  function toggleFav(item: NavItem) {
    startFav(async () => {
      await toggleUserFavorite({ label: item.label, href: item.href });
      router.refresh();
    });
  }

  // 사이드바 접힘 상태 유지(localStorage).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("erp-sidebar-collapsed") === "1");
    } catch {
      /* noop */
    }
  }, []);
  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("erp-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  }

  // 전역 단축키 — ⌘K / Ctrl+K 로 검색 팔레트 토글.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        // 데스크톱은 헤더의 큰 검색 바로 포커스, (바가 숨겨진) 모바일은 팔레트.
        const el = document.getElementById("erp-header-search") as HTMLInputElement | null;
        if (el && el.offsetParent !== null) el.focus();
        else setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* 데스크톱 화이트 사이드바 (테마 토큰 — 다크 자동 반전) · 접기 지원 */}
      <aside className={`fixed inset-y-0 left-0 hidden flex-col border-r border-line bg-panel py-5 transition-all md:flex ${collapsed ? "w-16 px-2" : "w-60 px-3.5"}`}>
        <div className={`flex items-center ${collapsed ? "flex-col gap-2" : "justify-between"}`}>
          <Link href="/dashboard" className="block rounded-lg px-1 pt-1 transition hover:opacity-80" aria-label="대시보드로">
            {collapsed ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-black text-white">V</span>
            ) : (
              <div className="px-1">
                <BrandLogo tone="auto" className="text-[22px]" />
                <p className="mt-1.5 text-[10px] tracking-[0.14em] text-slate-400">MARKETING ERP</p>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            title={collapsed ? "펼치기" : "접기"}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-surface hover:text-ink"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className={`flex-1 overflow-y-auto ${collapsed ? "mt-3" : ""}`}>
          {home ? (
            <div className="grid grid-cols-1 gap-0.5 pb-1">
              <NavLink item={home} active={isActive(pathname, home.href)} collapsed={collapsed} favorited={favHrefs.has(home.href)} onToggleFav={toggleFav} favPending={favPending} />
            </div>
          ) : null}
          {NAV_SECTIONS.map((section) => {
            const sectionItems = items.filter((i) => i.group === section);
            if (sectionItems.length === 0) return null;
            return (
              <div key={section}>
                {collapsed ? (
                  <div className="mx-2 my-2 border-t border-line" />
                ) : (
                  <p className="px-2.5 pb-1.5 pt-4 text-[10px] uppercase tracking-[0.12em] text-slate-400">{section}</p>
                )}
                <div className="grid grid-cols-1 gap-0.5">
                  {sectionItems.map((item) => (
                    <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={collapsed} favorited={favHrefs.has(item.href)} onToggleFav={toggleFav} favPending={favPending} />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="mt-3 flex items-center gap-2.5 border-t border-line px-2 pt-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-strong">
              {ROLE_LABEL[role].charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-ink">{ROLE_LABEL[role]}</p>
              <p className="text-[10px] text-slate-400">Marketing ERP</p>
            </div>
          </div>
        )}
      </aside>

      <main className={`min-h-screen transition-all ${collapsed ? "md:pl-16" : "md:pl-60"}`}>
        <header className="sticky top-0 z-10 border-b border-line bg-panel/95 px-4 py-3.5 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="min-w-0 shrink-0">
              <h1 className="text-base font-bold text-ink">{current?.label ?? "대시보드"}</h1>
              <p className="mt-0.5 text-xs text-slate-500">역할: {ROLE_LABEL[role]}</p>
            </div>
            {/* 데스크톱: 빈 공간을 채우는 큰 ERP 전체 검색 바 */}
            <div className="hidden min-w-0 flex-1 sm:block">
              <ErpSearch role={role} inputId="erp-header-search" />
            </div>
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

          {/* 즐겨찾기 바 — 검색바 바로 아래. 사이드바 별표로 고정한 페이지 바로가기. */}
          {favorites.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-0.5">
              <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
              {favorites.map((f) => {
                const active = isActive(pathname, f.href);
                return (
                  <Link
                    key={f.id}
                    href={f.href as ErpRoute}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      active ? "border-brand bg-brand text-white" : "border-line bg-card text-slate-600 hover:border-brand/40 hover:text-brand"
                    }`}
                  >
                    {f.label}
                  </Link>
                );
              })}
            </div>
          )}

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
