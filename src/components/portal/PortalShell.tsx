"use client";
// src/components/portal/PortalShell.tsx
// 거래처 포털 공통 쉘 — 사이드바 + 헤더

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

type ClientInfo = {
  id: string;
  name: string;
  code: string;
  assignedMarketer: { id: string; name: string; email: string } | null;
};

type UserInfo = { id: string; name: string; email: string };

const NAV = [
  { href: "/portal/dashboard" as const, icon: "🏠", label: "홈" },
  { href: "/portal/reports" as const,   icon: "📊", label: "보고서" },
  { href: "/portal/requests" as const,  icon: "📝", label: "요청/문의" },
  { href: "/portal/files" as const,     icon: "📁", label: "파일함" },
];

export function PortalShell({
  children,
  user,
  client,
}: {
  children: React.ReactNode;
  user: UserInfo;
  client: ClientInfo;
}) {
  const pathname = usePathname();
  const [sideOpen, setSideOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ── 사이드바 (데스크탑) ── */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-slate-100 shrink-0">
        {/* 브랜드 */}
        <div className="px-5 py-5 border-b border-slate-100">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mb-1">
            VENOM
          </p>
          <h2 className="text-sm font-bold text-slate-800 leading-tight">
            {client.name}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{client.code}</p>
        </div>

        {/* 내비 */}
        <nav className="flex-1 py-4 space-y-0.5 px-3">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/portal/dashboard" &&
                pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                  ${active
                    ? "bg-sky-50 text-sky-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 담당 마케터 */}
        {client.assignedMarketer && (
          <div className="px-4 py-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-1">담당 마케터</p>
            <p className="text-sm font-medium text-slate-700">
              {client.assignedMarketer.name}
            </p>
            <a
              href={`mailto:${client.assignedMarketer.email}`}
              className="text-xs text-sky-500 hover:underline"
            >
              {client.assignedMarketer.email}
            </a>
          </div>
        )}

        {/* 유저/로그아웃 */}
        <div className="px-4 py-4 border-t border-slate-100">
          <p className="text-xs text-slate-700 font-medium truncate">
            {user.name}
          </p>
          <p className="text-xs text-slate-400 truncate">{user.email}</p>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-2 text-xs text-slate-400 hover:text-red-500 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* ── 모바일 오버레이 사이드바 ── */}
      {sideOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setSideOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 bg-white border-r border-slate-100
          flex flex-col transition-transform duration-200 md:hidden
          ${sideOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="px-5 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest">VENOM</p>
            <h2 className="text-sm font-bold text-slate-800">{client.name}</h2>
          </div>
          <button
            onClick={() => setSideOpen(false)}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSideOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                ${pathname.startsWith(item.href)
                  ? "bg-sky-50 text-sky-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50"
                }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* ── 메인 ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 모바일 헤더 */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-100 sticky top-0 z-30">
          <button
            onClick={() => setSideOpen(true)}
            className="text-slate-500 hover:text-slate-700 text-xl"
          >
            ☰
          </button>
          <span className="text-sm font-bold text-slate-700">{client.name}</span>
        </header>

        <main className="flex-1 p-5 md:p-8 max-w-5xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
