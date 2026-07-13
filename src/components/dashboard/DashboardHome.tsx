import Link from "next/link";
import type { Route } from "next";
import {
  AlertTriangle, ArrowRight, Bot, BriefcaseBusiness, CalendarClock, CircleCheck, ClipboardList,
  CreditCard, Eye, FileSignature, FileText, ImageIcon, Link2, MessageCircleQuestion, Plane,
  ShieldCheck, Sparkles, Wallet
} from "lucide-react";
import { Role } from "@/domain/types";
import { ClientConfirmations } from "@/components/dashboard/ClientConfirmations";
import { ClientMonitor } from "@/components/dashboard/ClientMonitor";
import { PlatformUpdateBanner } from "@/components/dashboard/PlatformUpdateBanner";
import { RolePipeline } from "@/components/dashboard/RolePipeline";
import { WorkOverview } from "@/components/dashboard/WorkOverview";
import type { DashboardSummary } from "@/domain/dashboard";
import type { ClientConfirmations as Confirmations, ClientMonitorRow, RiskItem } from "@/server/repositories/dashboard-extras";
import type { GeoDashboardSummary } from "@/server/repositories/geo";
import type { LeadPipelineSummary } from "@/server/repositories/leads";
import { ACTIVE_LEAD_STAGES, leadStatusLabels } from "@/domain/sales/lead-stages";

const EMPTY_CONFIRMATIONS: Confirmations = { pending: [], recent: [] };

const won = new Intl.NumberFormat("ko-KR");

// EduNova 톤: 화이트 베이스 + 파스텔 멀티컬러 포인트. 오렌지는 시그니처(CTA·활성)로만.
type Tone = "blue" | "green" | "violet" | "amber" | "rose";
const TONE: Record<Tone, { card: string; icon: string; spark: string }> = {
  blue: { card: "bg-blue-50/70 border-blue-100", icon: "bg-blue-100 text-blue-600", spark: "#3b6fe0" },
  green: { card: "bg-emerald-50/70 border-emerald-100", icon: "bg-emerald-100 text-emerald-600", spark: "#12a570" },
  violet: { card: "bg-violet-50/70 border-violet-100", icon: "bg-violet-100 text-violet-600", spark: "#7c5cf0" },
  amber: { card: "bg-amber-50/70 border-amber-100", icon: "bg-amber-100 text-amber-600", spark: "#d98a12" },
  rose: { card: "bg-rose-50/70 border-rose-100", icon: "bg-rose-100 text-rose-600", spark: "#e0483a" }
};

type Kpi = { label: string; value: string; sub: string; up?: string; down?: string; icon: typeof ClipboardList; tone: Tone; points: string };

function kpisFor(role: Role, s: DashboardSummary): Kpi[] {
  if (role === Role.MARKETER) {
    return [
      { label: "오늘 업무", value: String(s.todayWorkCount), sub: "오늘 마감·처리", up: undefined, icon: ClipboardList, tone: "blue", points: "0,22 20,18 40,20 60,12 80,15 100,9 120,7" },
      { label: "담당 거래처", value: String(s.assignedClientCount), sub: "배정된 거래처", icon: BriefcaseBusiness, tone: "green", points: "0,20 20,20 40,16 60,17 80,11 100,10 120,6" },
      { label: "보고서 작업", value: String(s.reportTaskCount), sub: "월간·성과 자료", icon: FileText, tone: "violet", points: "0,14 20,16 40,12 60,18 80,15 100,19 120,16" },
      { label: "잔여 연차", value: `${s.leaveBalanceDays}일`, sub: "사용 가능", icon: Plane, tone: "amber", points: "0,18 20,17 40,14 60,15 80,12 100,11 120,9" }
    ];
  }
  if (role === Role.ADMIN) {
    return [
      { label: "지연 업무", value: String(s.delayedWorkCount), sub: "마감 지난 미완료", icon: AlertTriangle, tone: "rose", points: "0,10 20,14 40,12 60,18 80,16 100,20 120,22" },
      { label: "검토 필요", value: String(s.reviewNeededWorkCount), sub: "관리자 확인 필요", icon: CircleCheck, tone: "amber", points: "0,16 20,14 40,17 60,13 80,15 100,12 120,14" },
      { label: "다가오는 마감", value: String(s.upcomingDeadlineCount), sub: "오늘 이후 일정", icon: CalendarClock, tone: "blue", points: "0,20 20,18 40,20 60,12 80,15 100,10 120,8" },
      { label: "휴가 승인 대기", value: String(s.pendingLeaveCount), sub: "처리 필요 요청", icon: Plane, tone: "violet", points: "0,15 20,16 40,13 60,14 80,12 100,13 120,11" }
    ];
  }
  return [
    { label: "전체 업무", value: String(s.totalWorkCount), sub: `완료 ${s.completedWorkCount}건`, icon: ClipboardList, tone: "blue", points: "0,20 20,18 40,16 60,14 80,13 100,10 120,8" },
    { label: "지연 업무", value: String(s.delayedWorkCount), sub: "마감 지난 미완료", icon: AlertTriangle, tone: "rose", points: "0,10 20,14 40,12 60,18 80,16 100,20 120,22" },
    { label: "미수금", value: `${won.format(s.unpaidAmount)}원`, sub: "입금 확인 필요", icon: Wallet, tone: "amber", points: "0,18 20,16 40,17 60,13 80,14 100,11 120,10" },
    { label: "이번 달 지출", value: `${won.format(s.expenseTotal)}원`, sub: "등록된 회사 지출", icon: CreditCard, tone: "violet", points: "0,14 20,16 40,15 60,17 80,15 100,16 120,14" }
  ];
}

// Command Center — 역할별로 "지금 조치가 필요한 항목"만 액션 타일로. urgent=true는 값이 0보다 크면 처리 대상.
type Cmd = { key: string; label: string; value: number; href: Route; icon: typeof ClipboardList; tone: Tone; urgent?: boolean; money?: boolean };

function commandsFor(role: Role, s: DashboardSummary, riskCount: number, recontact: number): Cmd[] {
  if (role === Role.MARKETER) {
    // 담당자: 본인이 맡은 거래처·업무 중심. 미수금·전사 지표는 노출하지 않는다.
    return [
      { key: "today", label: "오늘 마감", value: s.todayWorkCount, href: "/work" as Route, icon: ClipboardList, tone: "blue" },
      { key: "review", label: "컨펌 대기", value: s.reviewNeededWorkCount, href: "/approvals" as Route, icon: CircleCheck, tone: "amber", urgent: true },
      { key: "delayed", label: "지연 업무", value: s.delayedWorkCount, href: "/work" as Route, icon: AlertTriangle, tone: "rose", urgent: true },
      { key: "risk", label: "위험 콘텐츠", value: riskCount, href: "/compliance" as Route, icon: ShieldCheck, tone: "rose", urgent: true },
      { key: "recontact", label: "재접촉 리드", value: recontact, href: "/leads" as Route, icon: Link2, tone: "violet", urgent: true },
      { key: "upcoming", label: "다가오는 마감", value: s.upcomingDeadlineCount, href: "/work" as Route, icon: CalendarClock, tone: "blue" }
    ];
  }
  if (role === Role.ADMIN) {
    // 관리자(배정 범위): 담당 범위의 운영 관리. 재무(미수금)는 최고관리자 몫이라 제외.
    return [
      { key: "delayed", label: "지연 업무", value: s.delayedWorkCount, href: "/work" as Route, icon: AlertTriangle, tone: "rose", urgent: true },
      { key: "review", label: "승인·검토 대기", value: s.reviewNeededWorkCount, href: "/approvals" as Route, icon: CircleCheck, tone: "amber", urgent: true },
      { key: "risk", label: "위험 콘텐츠", value: riskCount, href: "/compliance" as Route, icon: ShieldCheck, tone: "rose", urgent: true },
      { key: "recontact", label: "재접촉 리드", value: recontact, href: "/leads" as Route, icon: Link2, tone: "violet", urgent: true },
      { key: "leave", label: "휴가 승인", value: s.pendingLeaveCount, href: "/leave" as Route, icon: Plane, tone: "violet", urgent: true },
      { key: "upcoming", label: "다가오는 마감", value: s.upcomingDeadlineCount, href: "/work" as Route, icon: CalendarClock, tone: "blue" }
    ];
  }
  // 최고관리자(전사): 재무 포함 전체 경영판.
  return [
    { key: "delayed", label: "지연 업무", value: s.delayedWorkCount, href: "/work" as Route, icon: AlertTriangle, tone: "rose", urgent: true },
    { key: "review", label: "승인·검토 대기", value: s.reviewNeededWorkCount, href: "/approvals" as Route, icon: CircleCheck, tone: "amber", urgent: true },
    { key: "risk", label: "위험 콘텐츠", value: riskCount, href: "/compliance" as Route, icon: ShieldCheck, tone: "rose", urgent: true },
    { key: "unpaid", label: "미수금", value: s.unpaidAmount, money: true, href: "/finance" as Route, icon: Wallet, tone: "amber", urgent: true },
    { key: "leave", label: "휴가 승인", value: s.pendingLeaveCount, href: "/leave" as Route, icon: Plane, tone: "violet", urgent: true },
    { key: "upcoming", label: "다가오는 마감", value: s.upcomingDeadlineCount, href: "/work" as Route, icon: CalendarClock, tone: "blue" }
  ];
}

// 처리 대상(urgent·값>0) → 값>0 → 0건 순으로. 위험한 것이 항상 왼쪽 위로 온다.
function cmdRank(c: Cmd) {
  if (c.urgent && c.value > 0) return 0;
  if (c.value > 0) return 1;
  return 2;
}

// 역할별 Command Center 덱 — 정렬된 타일과 "조치 필요" 건수를 함께 계산.
function buildDeck(role: Role, summary: DashboardSummary, riskCount: number, recontact: number) {
  const commands = commandsFor(role, summary, riskCount, recontact).sort((a, b) => cmdRank(a) - cmdRank(b));
  const actionCount = commands.filter((c) => c.urgent && c.value > 0).length;
  return { commands, actionCount };
}

function CmdTile({ c }: { c: Cmd }) {
  const active = c.value > 0;
  const hot = active && !!c.urgent;
  const display = c.money ? (active ? `${won.format(c.value)}원` : "0원") : String(c.value);
  return (
    <Link
      href={c.href}
      className={`group relative flex flex-col justify-between rounded-2xl border p-3.5 transition hover:shadow-sm ${
        hot ? TONE[c.tone].card : active ? "border-line bg-white" : "border-line bg-surface/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${active ? TONE[c.tone].icon : "bg-slate-100 text-slate-400"}`}>
          <c.icon className="h-4 w-4" />
        </span>
        {hot ? <span className="h-2 w-2 rounded-full bg-rose-500" aria-label="조치 필요" /> : null}
      </div>
      <div className={`mt-2.5 font-extrabold leading-none tracking-tight ${c.money ? "text-[17px]" : "text-[22px]"} ${active ? "text-ink" : "text-slate-300"}`}>
        {display}
      </div>
      <div className="mt-1 flex items-center gap-1">
        <span className="text-[11.5px] font-semibold text-slate-500">{c.label}</span>
        <ArrowRight className="h-3 w-3 text-slate-300 opacity-0 transition group-hover:opacity-100" />
      </div>
    </Link>
  );
}

function Spark({ color, points }: { color: string; points: string }) {
  return (
    <svg viewBox="0 0 120 30" preserveAspectRatio="none" className="mt-2 block h-7 w-full">
      <polyline fill="none" stroke={color} strokeWidth={2} points={points} />
    </svg>
  );
}

const QUICK: { href: Route; label: string; icon: typeof ClipboardList; tone: Tone }[] = [
  { href: "/clients" as Route, label: "거래처", icon: BriefcaseBusiness, tone: "amber" },
  { href: "/contracts" as Route, label: "계약서", icon: FileSignature, tone: "blue" },
  { href: "/compliance" as Route, label: "의료법", icon: ShieldCheck, tone: "rose" },
  { href: "/approvals" as Route, label: "승인함", icon: CircleCheck, tone: "amber" },
  { href: "/reports" as Route, label: "보고서", icon: FileText, tone: "violet" },
  { href: "/ai-studio" as Route, label: "AI 마케팅", icon: Sparkles, tone: "green" },
  { href: "/image-studio" as Route, label: "이미지", icon: ImageIcon, tone: "blue" }
];

// ─── 공통 섹션 블록 ─────────────────────────────────────────────────────────
// 각 역할 뷰가 필요한 블록만 골라 조립한다. "화면·기능 분리"는 이 조립 단계에서 이뤄진다.

function GreetingBar({ first, actionCount, subject }: { first: string; actionCount: number; subject: string }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-blue-50 via-violet-50 to-white p-5 dark:bg-card dark:bg-none">
      <Sparkles className="pointer-events-none absolute right-6 top-5 h-4 w-4 text-violet-300" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-ink">
            좋은 하루예요, <span className="text-brand-strong">{first}</span>님 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            <span className="mr-1 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold text-slate-500 ring-1 ring-inset ring-line">{subject}</span>
            {actionCount > 0 ? (
              <>지금 조치가 필요한 항목이 <b className="text-brand-strong">{actionCount}건</b> 있어요.</>
            ) : (
              <>급히 처리할 항목이 없어요. 오늘도 순항 중입니다. 🙌</>
            )}
          </p>
        </div>
        <Link
          href={"/work" as Route}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-strong"
        >
          오늘 업무 보기 <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function CommandCenter({ commands, actionCount }: { commands: Cmd[]; actionCount: number }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-bold text-ink">지금 확인할 것</span>
        {actionCount > 0 ? (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600">조치 필요 {actionCount}</span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-600">모두 정상</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {commands.map((c) => (
          <CmdTile key={c.key} c={c} />
        ))}
      </div>
    </section>
  );
}

function AiQuickActions() {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Link href={"/clients" as Route} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4 transition hover:shadow-sm">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><Sparkles className="h-[18px] w-[18px]" /></span>
        <div>
          <b className="text-sm text-ink">AI 컨설팅 리포트</b>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">병원명·주소로 키워드·경쟁·상권 분석을 만듭니다.</p>
          <span className="mt-1.5 inline-block rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-600">컨설팅 실행 →</span>
        </div>
      </Link>
      <Link href={"/clients" as Route} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4 transition hover:shadow-sm">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600"><FileText className="h-[18px] w-[18px]" /></span>
        <div>
          <b className="text-sm text-ink">콘텐츠 기획 생성</b>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">주제·키워드로 방향·FAQ·Q&amp;A 초안 + 의료법 검수 자동.</p>
          <span className="mt-1.5 inline-block rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-600">콘텐츠 만들기 →</span>
        </div>
      </Link>
    </section>
  );
}

function LeadPipelineBar({ leadPipeline }: { leadPipeline: LeadPipelineSummary }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={"/leads" as Route} className="text-sm font-bold text-ink hover:underline">
          영업 파이프라인 →
        </Link>
        <div className="flex flex-wrap items-center gap-1.5">
          {ACTIVE_LEAD_STAGES.map((stage) => (
            <span key={stage} className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              {leadStatusLabels[stage]} <b className="text-ink">{leadPipeline.byStatus[stage] ?? 0}</b>
            </span>
          ))}
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
            계약성공 <b>{leadPipeline.byStatus["WON"] ?? 0}</b>
          </span>
        </div>
        {leadPipeline.recontactDueThisWeek > 0 ? (
          <span className="ml-auto text-xs font-semibold text-amber-600">
            이번 주 재접촉 {leadPipeline.recontactDueThisWeek}건
          </span>
        ) : null}
      </div>
    </section>
  );
}

function GeoBar({ geoSummary }: { geoSummary: GeoDashboardSummary }) {
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href={"/geo" as Route} className="flex items-center gap-1.5 text-sm font-bold text-ink hover:underline">
          <Bot className="h-4 w-4 text-emerald-600" /> SEO·GEO 실행 현황 →
        </Link>
        <div className="flex flex-wrap items-center gap-1.5">
          <GeoStat icon={MessageCircleQuestion} label="모니터링 질문" value={geoSummary.monitoredQuestions} />
          <GeoStat icon={Eye} label="최근 30일 출현" value={geoSummary.appearedRecent} />
          <GeoStat icon={Link2} label="공식 URL 인용" value={geoSummary.citedRecent} />
          <GeoStat icon={FileText} label="답변 초안" value={geoSummary.answerDrafts} />
        </div>
        {geoSummary.monitoredQuestions === 0 && (
          <span className="text-[11px] text-slate-500">아직 모니터링 중인 질문이 없습니다 — GEO 화면에서 후보를 생성해보세요.</span>
        )}
      </div>
    </section>
  );
}

function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((k) => (
        <div key={k.label} className={`rounded-2xl border p-4 ${TONE[k.tone].card}`}>
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-slate-500">{k.label}</span>
            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${TONE[k.tone].icon}`}><k.icon className="h-4 w-4" /></span>
          </div>
          <div className="mt-2.5 text-[26px] font-extrabold leading-none tracking-tight text-ink">{k.value}</div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            {k.up ? <b className="text-emerald-600">▲ {k.up} </b> : null}
            {k.down ? <b className="text-rose-500">▼ {k.down} </b> : null}
            {k.sub}
          </p>
          <Spark color={TONE[k.tone].spark} points={k.points} />
        </div>
      ))}
    </section>
  );
}

function QuickLinks() {
  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <p className="mb-3 text-sm font-bold text-ink">바로가기</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {QUICK.map((q) => (
          <Link key={q.href} href={q.href} className="flex flex-col items-center gap-2 rounded-xl px-2 py-3.5 transition hover:bg-surface">
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${TONE[q.tone].icon}`}><q.icon className="h-5 w-5" /></span>
            <span className="text-[11.5px] font-semibold text-ink">{q.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ComplianceAndReminders({ riskItems, summary }: { riskItems: RiskItem[]; summary: DashboardSummary }) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="mb-1 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-bold text-ink"><ShieldCheck className="h-4 w-4 text-rose-500" /> 의료법 위험 콘텐츠</p>
          <Link href={"/compliance" as Route} className="text-xs font-bold text-brand-strong">검수 도구 →</Link>
        </div>
        {riskItems.length === 0 ? (
          <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface/40 px-4 py-8 text-center text-sm text-slate-400">
            <ShieldCheck className="h-5 w-5 text-emerald-500" /> 감지된 위험 콘텐츠가 없습니다.
          </p>
        ) : (
          <ul>
            {riskItems.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-sm">🏥</span>
                <div className="min-w-0">
                  <b className="block truncate text-[13px] text-ink">{r.topic}</b>
                  <small className="text-[11.5px] text-slate-500">{r.clientName}{r.topFlag ? ` · ${r.topFlag}` : ""}</small>
                </div>
                <span className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${r.high > 0 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}>
                  {r.high > 0 ? `위험 ${r.high}` : `주의 ${r.medium}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-white p-5">
        <p className="mb-2 text-sm font-bold text-ink">처리 리마인더</p>
        <Reminder icon={CircleCheck} tone="amber" label="컨펌·검토 대기" value={summary.reviewNeededWorkCount} href={"/approvals" as Route} />
        <Reminder icon={CalendarClock} tone="blue" label="다가오는 마감" value={summary.upcomingDeadlineCount} href={"/work" as Route} />
        <Reminder icon={AlertTriangle} tone="rose" label="지연 업무" value={summary.delayedWorkCount} href={"/work" as Route} />
        <Reminder icon={Plane} tone="green" label="휴가 승인 대기" value={summary.pendingLeaveCount} href={"/leave" as Route} />
      </div>
    </section>
  );
}

// ─── 역할별 대시보드 뷰 ──────────────────────────────────────────────────────
// 화면·기능이 역할별로 확실히 분리된다:
//   · 담당자(마케터): 본인 담당 거래처·업무에 집중. 전사 경영 위젯(영업/GEO/전사 모니터링) 없음.
//   · 관리자(배정 범위): 담당 범위의 운영 관리 + 영업/GEO. 재무·전사 모니터링은 없음.
//   · 최고관리자(전사): 재무 포함 전체 경영판 + 전사 운영 모니터링.
// 승인된 관리자는 세션 effective role이 SUPER_ADMIN이 되어 자동으로 최고관리자 뷰를 본다.

type ViewProps = {
  first: string;
  summary: DashboardSummary;
  riskItems: RiskItem[];
  riskCount: number;
  clientMonitor: ClientMonitorRow[];
  confirmations: Confirmations;
  leadPipeline: LeadPipelineSummary;
  geoSummary: GeoDashboardSummary | null;
};

function MarketerDashboard({ first, summary, riskItems, riskCount, confirmations, leadPipeline }: ViewProps) {
  const { commands, actionCount } = buildDeck(Role.MARKETER, summary, riskCount, leadPipeline.recontactDueThisWeek);
  return (
    <div className="space-y-4">
      <GreetingBar first={first} actionCount={actionCount} subject="담당자" />
      <CommandCenter commands={commands} actionCount={actionCount} />
      <AiQuickActions />
      <RolePipeline role={Role.MARKETER} summary={summary} riskCount={riskCount} />
      <KpiGrid kpis={kpisFor(Role.MARKETER, summary)} />
      <QuickLinks />
      <WorkOverview summary={summary} />
      <ClientConfirmations data={confirmations} />
      <ComplianceAndReminders riskItems={riskItems} summary={summary} />
    </div>
  );
}

function AdminDashboard({ first, summary, riskItems, riskCount, confirmations, leadPipeline, geoSummary }: ViewProps) {
  const { commands, actionCount } = buildDeck(Role.ADMIN, summary, riskCount, leadPipeline.recontactDueThisWeek);
  return (
    <div className="space-y-4">
      <GreetingBar first={first} actionCount={actionCount} subject="관리자 · 배정 범위" />
      <CommandCenter commands={commands} actionCount={actionCount} />
      <LeadPipelineBar leadPipeline={leadPipeline} />
      {geoSummary && <GeoBar geoSummary={geoSummary} />}
      <RolePipeline role={Role.ADMIN} summary={summary} riskCount={riskCount} />
      <KpiGrid kpis={kpisFor(Role.ADMIN, summary)} />
      <QuickLinks />
      <AiQuickActions />
      <WorkOverview summary={summary} />
      <ClientConfirmations data={confirmations} />
      <ComplianceAndReminders riskItems={riskItems} summary={summary} />
    </div>
  );
}

function SuperAdminDashboard({ first, summary, riskItems, riskCount, clientMonitor, confirmations, leadPipeline, geoSummary }: ViewProps) {
  const { commands, actionCount } = buildDeck(Role.SUPER_ADMIN, summary, riskCount, leadPipeline.recontactDueThisWeek);
  return (
    <div className="space-y-4">
      <GreetingBar first={first} actionCount={actionCount} subject="최고관리자 · 전사" />
      <CommandCenter commands={commands} actionCount={actionCount} />
      <AiQuickActions />
      <LeadPipelineBar leadPipeline={leadPipeline} />
      {geoSummary && <GeoBar geoSummary={geoSummary} />}
      <RolePipeline role={Role.SUPER_ADMIN} summary={summary} riskCount={riskCount} />
      <KpiGrid kpis={kpisFor(Role.SUPER_ADMIN, summary)} />
      <QuickLinks />
      <WorkOverview summary={summary} />
      {/* 전사 운영 모니터링 — 최고관리자 전용 */}
      <ClientMonitor rows={clientMonitor} />
      <ClientConfirmations data={confirmations} />
      <ComplianceAndReminders riskItems={riskItems} summary={summary} />
    </div>
  );
}

export function DashboardHome({
  userName,
  role,
  summary,
  riskItems,
  clientMonitor = [],
  confirmations = EMPTY_CONFIRMATIONS,
  leadPipeline = { byStatus: {}, recontactDueThisWeek: 0 },
  geoSummary = null
}: {
  userName: string;
  role: Role;
  summary: DashboardSummary;
  riskItems: RiskItem[];
  clientMonitor?: ClientMonitorRow[];
  confirmations?: Confirmations;
  leadPipeline?: LeadPipelineSummary;
  geoSummary?: GeoDashboardSummary | null;
}) {
  const riskCount = riskItems.reduce((n, r) => n + (r.high > 0 ? 1 : 0), 0);
  const first = userName.replace(/(관리자|님)$/g, "") || userName;
  const view: ViewProps = { first, summary, riskItems, riskCount, clientMonitor, confirmations, leadPipeline, geoSummary };

  // effective role 기준 분기 — 승인된 관리자는 role이 SUPER_ADMIN이라 최고관리자 뷰로 자동 진입.
  const body =
    role === Role.MARKETER ? <MarketerDashboard {...view} /> :
    role === Role.ADMIN ? <AdminDashboard {...view} /> :
    <SuperAdminDashboard {...view} />;

  // 플랫폼 공지 배너는 모든 역할 공통 — 대시보드 최상단에 한 개.
  return (
    <div className="space-y-4">
      <PlatformUpdateBanner />
      {body}
    </div>
  );
}

function GeoStat({ icon: Icon, label, value }: { icon: typeof ClipboardList; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-card px-2.5 py-1 text-[11px] font-medium text-slate-600">
      <Icon className="h-3.5 w-3.5 text-emerald-600" />
      {label} <b className="text-ink">{value}</b>
    </span>
  );
}

function Reminder({ icon: Icon, tone, label, value, href }: { icon: typeof ClipboardList; tone: Tone; label: string; value: number; href: Route }) {
  return (
    <Link href={href} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0 transition hover:opacity-80">
      <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${TONE[tone].icon}`}><Icon className="h-4 w-4" /></span>
      <span className="text-[13px] text-slate-600">{label}</span>
      <span className={`ml-auto text-sm font-bold ${value > 0 ? "text-ink" : "text-slate-300"}`}>{value}</span>
    </Link>
  );
}
