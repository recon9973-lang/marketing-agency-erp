// 계정·비밀번호 관리 — 독립 툴(설정 페이지와 분리, 데이터 의존 최소화로 항상 뜨게).
// 내 로그인 비밀번호 변경 + (관리자) 직원 로그인 링크 발급. 로그인만 되면 여기서 접근을 복구할 수 있다.
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminPasswordCard } from "@/components/settings/AdminPasswordCard";
import { SelfPasswordCard } from "@/components/account/SelfPasswordCard";
import { StaffAccessTool } from "@/components/account/StaffAccessTool";
import { getCurrentUser } from "@/server/session";
import { Role } from "@/domain/types";
import { db } from "@/server/db";

const roleLabel: Record<string, string> = { SUPER_ADMIN: "최고관리자", ADMIN: "관리자", MARKETER: "담당자" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isSuperAdmin = user.role === Role.SUPER_ADMIN;
  const isAdmin = isSuperAdmin || user.role === Role.ADMIN;

  // 본인 비밀번호 설정 여부 — 조회 실패해도 페이지가 죽지 않게 방어.
  const me = await db.user
    .findUnique({ where: { id: user.id }, select: { passwordHash: true } })
    .catch(() => null);
  const hasOwnPassword = Boolean(me?.passwordHash);

  // 직원 목록 — 실패해도 페이지가 죽지 않게 방어(비밀번호 카드는 항상 뜨도록).
  const staff = isAdmin
    ? await db.user
        .findMany({
          where: { role: { in: [Role.ADMIN, Role.MARKETER] } },
          orderBy: [{ status: "asc" }, { name: "asc" }],
          select: { id: true, name: true, email: true, role: true, status: true }
        })
        .catch(() => [] as { id: string; name: string; email: string; role: string; status: string }[])
    : [];

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="관리 · 보안"
        title="계정 · 비밀번호"
        description="내 로그인 비밀번호를 변경하고, 직원의 로그인 접근(로그인 링크)을 관리합니다. 로그인이 안 되는 계정의 접근을 여기서 복구할 수 있습니다."
      />

      {/* 내 계정 */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="text-sm font-bold text-ink">내 계정</p>
        <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-sm">
          <span className="text-slate-500">이메일 <b className="ml-1 text-ink">{user.email}</b></span>
          <span className="text-slate-500">역할 <b className="ml-1 text-ink">{roleLabel[user.role] ?? user.role}</b></span>
        </div>
      </div>

      {/* 내 로그인 비밀번호 — 모든 역할(담당자 포함) 본인 비밀번호 설정·변경 */}
      <SelfPasswordCard email={user.email} hasPassword={hasOwnPassword} />

      {/* 복구용 마스터 비밀번호 (최고관리자) — Vercel ADMIN_EMAIL 계정, 잠금 대비용 */}
      {isSuperAdmin && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h3 className="mb-1 text-base font-semibold text-ink">복구용 마스터 비밀번호</h3>
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            <b>ADMIN_EMAIL</b> 계정의 비밀번호입니다(잠금 대비 복구용). 특수문자(<code className="rounded bg-surface px-1">\ ₩ &apos; &quot;</code>) 없이 <b>영문+숫자</b> 조합을 권장합니다.
          </p>
          <AdminPasswordCard adminEmail={process.env.ADMIN_EMAIL ?? null} />
        </div>
      )}

      {/* 직원 로그인 접근 (관리자) */}
      {isAdmin && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h3 className="mb-1 text-base font-semibold text-ink">직원 로그인 접근</h3>
          <p className="mb-3 text-xs text-slate-500">직원 로그인이 안 될 때, 로그인 링크를 발급·복사해 전달하면 즉시 접속됩니다.</p>
          <StaffAccessTool staff={staff} />
        </div>
      )}
    </section>
  );
}
