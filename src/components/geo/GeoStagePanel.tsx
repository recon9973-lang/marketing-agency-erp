// GEO 단계 패널 — 아직 인라인 통합 전(P2.2~) 단계의 안내 + 기존 도구로 이어가는 CTA.
// 거래처 컨텍스트를 그대로 넘겨 "키워드/자료를 고르면 이어서 진행"되게 한다.
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import type { GeoStage } from "@/domain/geo/stages";

export function GeoStagePanel({
  stage,
  clientName,
  ctaHref,
  ctaLabel,
  tier
}: {
  stage: GeoStage;
  clientName: string;
  ctaHref: string;
  ctaLabel: string;
  tier?: "measured" | "approx" | "demo";
}) {
  const tierMeta =
    tier === "measured"
      ? { label: "실측", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
      : tier === "approx"
        ? { label: "근사", cls: "bg-sky-50 text-sky-700 border-sky-200" }
        : tier === "demo"
          ? { label: "데모", cls: "bg-amber-50 text-amber-700 border-amber-200" }
          : null;

  return (
    <div className="rounded-2xl border border-line bg-card p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
          {stage.step}
        </span>
        <h3 className="text-base font-bold text-ink">{stage.label}</h3>
        {tierMeta && (
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${tierMeta.cls}`}>{tierMeta.label}</span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{stage.desc}</p>
      {clientName && (
        <p className="mt-1 text-xs text-slate-400">
          선택 거래처: <b className="text-slate-600">{clientName}</b>
        </p>
      )}
      <Link
        href={ctaHref as Route}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        {ctaLabel} <ArrowRight className="h-4 w-4" />
      </Link>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        이 단계는 곧 이 화면 안에서 바로 진행되도록 통합됩니다(현재는 전용 도구로 이어집니다).
      </p>
    </div>
  );
}
