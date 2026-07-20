"use client";

// 직원 권한 — 직원별 카드 하나에 역할·설정접근·메뉴권한·로그인링크를 모아 직관적으로 관리.
// (기존 '직원 초대·권한' 표 + '기능 접근 권한' 매트릭스를 사람 중심으로 통합)
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, ChevronDown, Link2, Check, ShieldCheck, Crown, User, Circle } from "lucide-react";
import {
  inviteEmployee,
  changeRole,
  setExpensePolicy,
  setSettingsAccess,
  getOrCreateLoginLink,
  setUserFeatureAccess
} from "@/server/actions/employees";
import { CONTROLLABLE_FEATURES, type FeatureKey } from "@/domain/features";

type Employee = { id: string; name: string; email: string; role: string; status: string; canAccessSettings: boolean; deniedFeatures: FeatureKey[] };

// 메뉴(기능) 권한 설명 — 무엇을 켜고 끄는지 사람 말로.
const FEATURE_DESC: Record<FeatureKey, string> = {
  finance: "거래처 청구·입금, 회사 지출/정산 관리",
  contracts: "계약서 작성·서명·발송",
  leads: "영업 리드(잠재 거래처)·무료진단·컨설팅",
  leave: "연차·휴가 등 근태"
};

const ROLE_META: Record<string, { label: string; icon: typeof User; tone: string; desc: string }> = {
  SUPER_ADMIN: { label: "최고관리자", icon: Crown, tone: "text-amber-600 bg-amber-50 border-amber-200", desc: "모든 기능·전체 거래처·최종 결재. 권한 제한 없음." },
  ADMIN: { label: "관리자", icon: ShieldCheck, tone: "text-brand bg-brand-soft border-brand/30", desc: "접근 범위 내 거래처·담당자 관리, 결재 1차 검토. 설정 접근은 허용 시 가능." },
  MARKETER: { label: "담당자", icon: User, tone: "text-slate-600 bg-surface border-line", desc: "배정된 거래처만. 본인 업무·보고·콘텐츠 중심." }
};

const STATUS_LABEL: Record<string, string> = { ACTIVE: "활성", INVITED: "초대", SUSPENDED: "정지", PENDING: "승인대기" };

export function StaffPermissionManager({
  employees,
  isSuperAdmin,
  adminCanManageExpense
}: {
  employees: Employee[];
  isSuperAdmin: boolean;
  adminCanManageExpense: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function invite(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await inviteEmployee({ email: String(formData.get("email")), name: String(formData.get("name")), role: String(formData.get("role")) });
      if (!res.ok) setError(res.error);
    });
  }
  function toggleExpense(v: boolean) {
    start(async () => {
      const res = await setExpensePolicy({ adminCanManageExpense: v });
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {/* 역할 안내 — 무엇을 뜻하는지 한눈에 */}
      <div className="grid gap-2 sm:grid-cols-3">
        {(["MARKETER", "ADMIN", "SUPER_ADMIN"] as const).map((r) => {
          const m = ROLE_META[r];
          const Icon = m.icon;
          return (
            <div key={r} className={`rounded-xl border p-3 ${m.tone}`}>
              <p className="flex items-center gap-1.5 text-sm font-bold"><Icon className="h-4 w-4" /> {m.label}</p>
              <p className="mt-1 text-[11px] leading-relaxed opacity-80">{m.desc}</p>
            </div>
          );
        })}
      </div>

      {/* 직원 초대 */}
      <form action={invite} className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-card p-4">
        <p className="mb-1 w-full text-sm font-bold text-ink">직원 초대</p>
        <label className="block"><span className="text-xs text-slate-500">이메일</span><input name="email" type="email" required placeholder="name@company.com" className="mt-1 block rounded-md border border-line px-3 py-2 text-sm" /></label>
        <label className="block"><span className="text-xs text-slate-500">이름</span><input name="name" required placeholder="홍길동" className="mt-1 block rounded-md border border-line px-3 py-2 text-sm" /></label>
        <label className="block"><span className="text-xs text-slate-500">역할</span>
          <select name="role" className="mt-1 block rounded-md border border-line px-3 py-2 text-sm"><option value="MARKETER">담당자</option><option value="ADMIN">관리자</option></select>
        </label>
        <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <UserPlus className="h-4 w-4" /> 초대
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}

      {/* 직원별 권한 카드 */}
      <div className="space-y-2">
        <p className="text-sm font-bold text-ink">직원별 권한 <span className="text-slate-400">({employees.length})</span></p>
        {employees.map((e) => (
          <StaffCard key={e.id} employee={e} isSuperAdmin={isSuperAdmin} onError={setError} />
        ))}
      </div>

      {/* 관리자 지출 권한 정책 */}
      {isSuperAdmin && (
        <label className="flex items-center gap-2 rounded-2xl border border-line bg-card p-4">
          <input type="checkbox" defaultChecked={adminCanManageExpense} onChange={(e) => toggleExpense(e.target.checked)} disabled={pending} className="h-4 w-4 accent-brand" />
          <span className="text-sm text-ink">관리자에게 <b>회사 지출 등록·검토</b> 권한 허용</span>
        </label>
      )}
    </div>
  );
}

function StaffCard({ employee: e, isSuperAdmin, onError }: { employee: Employee; isSuperAdmin: boolean; onError: (s: string | null) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [denied, setDenied] = useState<FeatureKey[]>(e.deniedFeatures);

  const isSuper = e.role === "SUPER_ADMIN";
  const meta = ROLE_META[e.role] ?? ROLE_META.MARKETER;
  const RoleIcon = meta.icon;

  function setRole(role: string) {
    onError(null);
    start(async () => {
      const res = await changeRole({ userId: e.id, role });
      if (!res.ok) onError(res.error);
      else router.refresh();
    });
  }
  function toggleSettings(v: boolean) {
    onError(null);
    start(async () => {
      const res = await setSettingsAccess({ userId: e.id, canAccess: v });
      if (!res.ok) onError(res.error);
      else router.refresh();
    });
  }
  function toggleFeature(key: FeatureKey, allow: boolean) {
    const next = allow ? denied.filter((k) => k !== key) : [...new Set([...denied, key])];
    setDenied(next);
    onError(null);
    start(async () => {
      const res = await setUserFeatureAccess({ userId: e.id, deniedFeatures: next });
      if (!res.ok) {
        onError("권한 변경에 실패했습니다.");
        setDenied(e.deniedFeatures);
      } else router.refresh();
    });
  }
  function makeLink() {
    onError(null);
    start(async () => {
      const res = await getOrCreateLoginLink({ userId: e.id });
      if (!res.ok || !res.data) { onError("로그인 링크 생성에 실패했습니다."); return; }
      const url = `${window.location.origin}/invite/${res.data.token}`;
      setLink(url);
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        /* 클립보드 차단 시 아래 입력칸에서 수동 복사 */
      }
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${meta.tone}`}><RoleIcon className="h-4 w-4" /></span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{e.name}</span>
            <span className="block truncate text-[11px] text-slate-400">{e.email}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.tone}`}>{meta.label}</span>
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400"><Circle className={`h-2 w-2 ${e.status === "ACTIVE" ? "fill-emerald-500 text-emerald-500" : "fill-slate-300 text-slate-300"}`} />{STATUS_LABEL[e.status] ?? e.status}</span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-line p-4">
          {isSuper ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">최고관리자는 모든 권한을 가지며 제한할 수 없습니다.</p>
          ) : (
            <>
              {/* 역할 */}
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500">역할</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["MARKETER", "ADMIN"] as const).map((r) => {
                    const on = e.role === r;
                    return (
                      <button key={r} type="button" onClick={() => !on && setRole(r)} disabled={pending} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${on ? "border-brand bg-brand text-white" : "border-line bg-white text-slate-600 hover:border-brand/40"}`}>
                        {ROLE_META[r].label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{meta.desc}</p>
              </div>

              {/* 설정(인사관리) 접근 */}
              {isSuperAdmin && (
                <div className="flex items-center justify-between rounded-lg border border-line bg-surface/40 px-3 py-2">
                  <span className="text-xs text-slate-600"><b>인사관리·설정 화면</b> 접근 — 이 직원이 권한·연동 설정을 열 수 있게 합니다.</span>
                  <Toggle checked={e.canAccessSettings} onChange={toggleSettings} disabled={pending} />
                </div>
              )}

              {/* 메뉴(기능) 권한 */}
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500">메뉴 접근 권한 <span className="font-normal text-slate-400">— 끄면 해당 메뉴가 숨겨지고 접근이 차단됩니다</span></p>
                <div className="space-y-1.5">
                  {CONTROLLABLE_FEATURES.map((f) => {
                    const allowed = !denied.includes(f.key);
                    return (
                      <div key={f.key} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2">
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink">{f.label}</span>
                          <span className="block text-[11px] text-slate-400">{FEATURE_DESC[f.key]}</span>
                        </span>
                        <Toggle checked={allowed} onChange={(v) => toggleFeature(f.key, v)} disabled={pending} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 로그인 링크 */}
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-500">로그인 링크</p>
                <button type="button" onClick={makeLink} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand hover:text-brand disabled:opacity-50">
                  {copied ? <><Check className="h-3.5 w-3.5" /> 복사됨</> : <><Link2 className="h-3.5 w-3.5" /> 링크 생성·복사</>}
                </button>
                {link ? <input readOnly value={link} onFocus={(ev) => ev.currentTarget.select()} className="mt-1.5 w-full max-w-md rounded border border-line bg-surface px-2 py-1 text-[10px] text-slate-500" /> : null}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${checked ? "bg-brand" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}
