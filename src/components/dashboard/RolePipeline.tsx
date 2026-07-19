import Link from "next/link";
import type { Route } from "next";
import { Role } from "@/domain/types";
import type { DashboardSummary } from "@/domain/dashboard";

// 역할별 워크플로우 파이프라인 — 각 역할의 운영 흐름을 라이브 지표가 달린
// 이동 가능한 단계 스트립으로 대시보드 상단에 노출. (docs/role-workflow-pipelines.md)

const won = new Intl.NumberFormat("ko-KR");

type Tone = "amber" | "blue" | "violet" | "rose" | "green";
const BADGE: Record<Tone, string> = {
  amber: "bg-amber-100 text-amber-600",
  blue: "bg-blue-100 text-blue-600",
  violet: "bg-violet-100 text-violet-600",
  rose: "bg-rose-100 text-rose-600",
  green: "bg-emerald-100 text-emerald-600"
};

type Stage = { title: string; desc: string; href: Route; tone: Tone; metric?: { label: string; value: string } };

const ROLE_LABEL: Record<Role, string> = {
  [Role.SUPER_ADMIN]: "총괄 운영",
  [Role.ADMIN]: "팀·거래처 관리",
  [Role.MARKETER]: "마케팅 실행"
};

function stagesFor(role: Role, s: DashboardSummary, riskCount: number): Stage[] {
  if (role === Role.SUPER_ADMIN) {
    return [
      { title: "거래처 온보딩", desc: "병원 등록·업종·담당 배정", href: "/clients" as Route, tone: "amber", metric: { label: "거래처", value: String(s.assignedClientCount) } },
      { title: "계약 체결", desc: "상품 구성·서명·업무 자동생성", href: "/contracts" as Route, tone: "blue" },
      { title: "조직·권한", desc: "직원 초대·역할·범위", href: "/settings" as Route, tone: "violet" },
      { title: "전사 모니터링", desc: "전체 업무·지연 현황", href: "/work" as Route, tone: "rose", metric: { label: "지연", value: String(s.delayedWorkCount) } },
      { title: "정산·재무", desc: "청구·입금·지출", href: "/finance" as Route, tone: "green", metric: { label: "미수금", value: `${won.format(s.unpaidAmount)}원` } },
      { title: "최종 승인", desc: "상위 승인·에스컬레이션", href: "/approvals" as Route, tone: "amber", metric: { label: "검토", value: String(s.reviewNeededWorkCount) } }
    ];
  }
  if (role === Role.ADMIN) {
    return [
      { title: "업무 배분·진행", desc: "배정·마감·지연 관리", href: "/work" as Route, tone: "blue", metric: { label: "전체", value: String(s.totalWorkCount) } },
      { title: "산출물 검수", desc: "콘텐츠·원고 의료법 검수", href: "/compliance" as Route, tone: "rose", metric: { label: "위험", value: String(riskCount) } },
      { title: "승인·반려", desc: "Approval 처리", href: "/approvals" as Route, tone: "amber", metric: { label: "검토", value: String(s.reviewNeededWorkCount) } },
      { title: "거래처 컨펌", desc: "컨펌 요청·피드백", href: "/clients" as Route, tone: "violet" },
      { title: "보고", desc: "월간·주간 보고", href: "/reports" as Route, tone: "green", metric: { label: "보고서", value: String(s.reportTaskCount) } },
      { title: "1차 승인", desc: "휴가·지출", href: "/leave" as Route, tone: "amber", metric: { label: "대기", value: String(s.pendingLeaveCount) } }
    ];
  }
  return [
    { title: "거래처 파악", desc: "채널별 마케팅 인사이트", href: "/insights" as Route, tone: "amber", metric: { label: "담당", value: String(s.assignedClientCount) } },
    { title: "콘텐츠 기획", desc: "주제·키워드·FAQ", href: "/ai-studio" as Route, tone: "blue" },
    { title: "제작", desc: "원고·이미지·카드뉴스", href: "/image-studio" as Route, tone: "violet" },
    { title: "의료법 검수", desc: "자동 검수·위험 수정", href: "/compliance" as Route, tone: "rose", metric: { label: "위험", value: String(riskCount) } },
    { title: "컨펌 요청", desc: "거래처 포털 컨펌", href: "/approvals" as Route, tone: "green", metric: { label: "대기", value: String(s.reviewNeededWorkCount) } },
    { title: "게시·성과", desc: "순위·방문자 추적(발행은 관리자)", href: "/insights" as Route, tone: "amber", metric: { label: "오늘", value: String(s.todayWorkCount) } }
  ];
}

export function RolePipeline({ role, summary, riskCount }: { role: Role; summary: DashboardSummary; riskCount: number }) {
  const stages = stagesFor(role, summary, riskCount);
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-ink">워크플로우 파이프라인</p>
        <span className="text-xs text-slate-400">{ROLE_LABEL[role]} 흐름</span>
      </div>
      <ol className="flex flex-col gap-3 md:flex-row md:items-stretch">
        {stages.map((stage, i) => (
          <li key={stage.title} className="relative md:flex-1">
            <Link
              href={stage.href}
              className="flex h-full flex-col gap-1.5 rounded-xl border border-line p-3.5 transition hover:border-brand/40 hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-extrabold ${BADGE[stage.tone]}`}>{i + 1}</span>
                <b className="text-[13px] text-ink">{stage.title}</b>
              </div>
              <p className="text-[11px] leading-4 text-slate-500">{stage.desc}</p>
              {stage.metric ? (
                <span className="mt-auto pt-1 text-[11px] font-semibold text-slate-500">
                  {stage.metric.label} <b className="text-brand-strong">{stage.metric.value}</b>
                </span>
              ) : (
                <span className="mt-auto pt-1 text-[11px] font-semibold text-slate-300">바로가기 →</span>
              )}
            </Link>
            {i < stages.length - 1 ? (
              <span className="pointer-events-none absolute -right-[11px] top-1/2 hidden -translate-y-1/2 text-lg leading-none text-slate-300 md:block">›</span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
