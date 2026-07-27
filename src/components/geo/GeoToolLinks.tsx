// G4 — GEO 도구 통합 진입점. 흩어진 7개 GEO 라우트를 거래처 컨텍스트와 함께 한곳에서.
// 설계 Q7: 라우트·골든테스트·URL은 보존하고 진입점만 거래처에 종속(?client 전달).
import Link from "next/link";
import type { Route } from "next";

type Tool = { href: string; code: string; label: string; desc: string; passClient: boolean };

// passClient=true: 해당 라우트가 ?client 를 읽어 거래처 컨텍스트 유지. false: 입력폼형(독립).
const TOOLS: Tool[] = [
  { href: "/geo-scan", code: "M1", label: "스캐너", desc: "4-AI 브랜드 인용율 스캔", passClient: true },
  { href: "/geo-cep", code: "M2", label: "CEP 파인더", desc: "카테고리 진입점 발굴·클러스터", passClient: true },
  { href: "/journeymap", code: "M4", label: "키워드 여정맵", desc: "키워드 발굴·검색여정·진단", passClient: false },
  { href: "/geo?tab=content-diagnosis", code: "M3", label: "콘텐츠 진단", desc: "E-E-A-T·FAQ·BLUF 점검", passClient: true },
  { href: "/geo?tab=campaign", code: "M5", label: "캠페인 플래너", desc: "목표→채널믹스→ROI→일정", passClient: true },
  { href: "/geo-studio", code: "◎", label: "GEO 스튜디오", desc: "통합 대시보드·주간 리포트", passClient: true }
];

export function GeoToolLinks({ clientId }: { clientId: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-strong">도구</span>
        <h3 className="text-sm font-bold text-ink">GEO 분석 도구</h3>
      </div>
      <p className="mb-3 text-[11px] text-slate-500">이 거래처로 이어서 분석 — 스캔·CEP·여정·콘텐츠·플래너를 한곳에서</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TOOLS.map((t) => {
          const href = (t.passClient ? `${t.href}${t.href.includes("?") ? "&" : "?"}client=${clientId}` : t.href) as Route;
          return (
            <Link
              key={t.href}
              href={href}
              className="group flex flex-col gap-0.5 rounded-xl border border-line bg-surface/60 p-3 transition-colors hover:border-brand/40 hover:bg-brand/5"
            >
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] font-bold text-brand">{t.code}</span>
                <span className="text-xs font-semibold text-ink group-hover:text-brand-strong">{t.label}</span>
              </span>
              <span className="text-[10px] leading-tight text-slate-400">{t.desc}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
