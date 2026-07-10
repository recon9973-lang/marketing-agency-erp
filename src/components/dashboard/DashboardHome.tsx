import Link from "next/link";
import type { Route } from "next";
import {
  AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarClock, CircleCheck, ClipboardList,
  CreditCard, FileSignature, FileText, ImageIcon, Plane, ShieldCheck, Sparkles, Wallet
} from "lucide-react";
import { Role } from "@/domain/types";
import { ClientConfirmations } from "@/components/dashboard/ClientConfirmations";
import { ClientMonitor } from "@/components/dashboard/ClientMonitor";
import { RolePipeline } from "@/components/dashboard/RolePipeline";
import { WorkOverview } from "@/components/dashboard/WorkOverview";
import type { DashboardSummary } from "@/domain/dashboard";
import type { ClientConfirmations as Confirmations, ClientMonitorRow, RiskItem } from "@/server/repositories/dashboard-extras";

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

export function DashboardHome({
  userName,
  role,
  summary,
  riskItems,
  clientMonitor = [],
  confirmations = EMPTY_CONFIRMATIONS
}: {
  userName: string;
  role: Role;
  summary: DashboardSummary;
  riskItems: RiskItem[];
  clientMonitor?: ClientMonitorRow[];
  confirmations?: Confirmations;
}) {
  const kpis = kpisFor(role, summary);
  const riskCount = riskItems.reduce((n, r) => n + (r.high > 0 ? 1 : 0), 0);
  const first = userName.replace(/(관리자|님)$/g, "") || userName;

  return (
    <div className="space-y-4">
      {/* 히어로 */}
      <section className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-blue-50 via-violet-50 to-white p-6">
          <Sparkles className="pointer-events-none absolute right-9 top-6 h-5 w-5 text-violet-300" />
          <Sparkles className="pointer-events-none absolute right-28 top-14 h-3 w-3 text-brand/40" />
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            좋은 하루예요, <span className="text-brand-strong">{first}</span>님 👋
          </h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            오늘 처리할 업무 <b className="text-brand-strong">{summary.todayWorkCount}건</b>, 컨펌 대기{" "}
            <b className="text-brand-strong">{summary.reviewNeededWorkCount}건</b>
            {riskCount > 0 ? (
              <> · 의료법 위험 콘텐츠 <b className="text-brand-strong">{riskCount}건</b>은 게시 전 검수가 필요합니다.</>
            ) : (
              <>이 있습니다.</>
            )}
          </p>
          <Link
            href={"/work" as Route}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-strong"
          >
            오늘 업무 보기 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-3">
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
        </div>
      </section>

      {/* 역할별 워크플로우 파이프라인 */}
      <RolePipeline role={role} summary={summary} riskCount={riskCount} />

      {/* KPI */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      {/* 바로가기 */}
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

      {/* 업무 개요(완료율·상태·대기) */}
      <WorkOverview summary={summary} />

      {/* 전사 운영 모니터링(최고관리자 전용) */}
      <ClientMonitor rows={clientMonitor} />

      {/* 거래처 컨펌 관리(관리자·담당자 파이프라인) */}
      <ClientConfirmations data={confirmations} />

      {/* 의료법 위험 콘텐츠 + 리마인더 */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
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
    </div>
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
