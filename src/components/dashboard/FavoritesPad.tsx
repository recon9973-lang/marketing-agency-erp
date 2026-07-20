"use client";

// 대시보드 위젯 — 개인 즐겨찾기(계정별). 자주 쓰는 페이지를 별표로 고정 + 즐겨찾기 거래처.
import Link from "next/link";
import type { Route } from "next";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, ArrowUpRight } from "lucide-react";
import { toggleUserFavorite } from "@/server/actions/favorites";
import type { FavoriteRow } from "@/server/repositories/user-favorite";

// 즐겨찾기 후보 프리셋(자주 쓰는 페이지).
const PRESET: { label: string; href: string }[] = [
  { label: "GEO", href: "/geo" },
  { label: "거래처", href: "/clients" },
  { label: "영업 리드", href: "/leads" },
  { label: "결재", href: "/reports" },
  { label: "스튜디오", href: "/studio" },
  { label: "업무관리", href: "/work" },
  { label: "캘린더", href: "/calendar" },
  { label: "회의록", href: "/meetings" },
  { label: "보관함", href: "/vault" }
];

export function FavoritesPad({
  favorites,
  clientFavorites
}: {
  favorites: FavoriteRow[];
  clientFavorites: { title: string; href: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const favHrefs = new Set(favorites.map((f) => f.href));

  function toggle(label: string, href: string) {
    start(async () => {
      await toggleUserFavorite({ label, href });
      router.refresh();
    });
  }

  return (
    <section className="flex h-full flex-col rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-bold text-ink">즐겨찾기</h2>
      </div>

      {/* 내 즐겨찾기 바로가기 */}
      {favorites.length + clientFavorites.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {favorites.map((f) => (
            <Link key={f.id} href={f.href as Route} className="inline-flex items-center gap-1 rounded-lg border border-brand/30 bg-brand-soft px-2.5 py-1.5 text-xs font-semibold text-brand-strong hover:bg-brand/10">
              {f.label} <ArrowUpRight className="h-3 w-3" />
            </Link>
          ))}
          {clientFavorites.map((c) => (
            <Link key={c.href} href={c.href as Route} className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand/40 hover:text-brand">
              {c.title} <ArrowUpRight className="h-3 w-3" />
            </Link>
          ))}
        </div>
      )}

      {/* 페이지 즐겨찾기 토글 */}
      <p className="mt-4 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">페이지 고정</p>
      <div className="flex flex-wrap gap-1.5">
        {PRESET.map((p) => {
          const on = favHrefs.has(p.href);
          return (
            <button
              key={p.href}
              type="button"
              onClick={() => toggle(p.label, p.href)}
              disabled={pending}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                on ? "border-brand bg-brand text-white" : "border-line bg-card text-slate-500 hover:border-brand/40 hover:text-brand"
              } disabled:opacity-50`}
            >
              <Star className={`h-3 w-3 ${on ? "fill-white" : ""}`} /> {p.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
