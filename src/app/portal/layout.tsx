// src/app/(portal)/layout.tsx
// 거래처 포털 전용 레이아웃 — ERP 내부 메뉴와 완전 분리

import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { PortalShell } from "@/components/portal/PortalShell";
import { db } from "@/server/db";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // 비로그인 → 로그인 페이지
  if (!session?.user?.id) {
    redirect("/login");
  }

  // DB에서 역할 확인 (세션에는 role이 포함되지 않음)
  const portalUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      clientId: true,
    },
  });

  if (!portalUser) redirect("/login");

  // CLIENT가 아닌 역할이 포털 URL에 접근하면 ERP 대시보드로
  if (portalUser.role !== "CLIENT") {
    redirect("/dashboard");
  }

  if (!portalUser.clientId) {
    // clientId가 없는 CLIENT 계정은 관리자에게 연락 안내
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl shadow p-10 max-w-sm text-center space-y-4">
          <p className="text-2xl">⚠️</p>
          <h1 className="text-lg font-semibold text-slate-800">
            계정 연결 필요
          </h1>
          <p className="text-sm text-slate-500">
            담당 마케터에게 계정 연결을 요청해 주세요.
          </p>
        </div>
      </div>
    );
  }

  const client = await db.client.findUnique({
    where: { id: portalUser.clientId },
    select: {
      id: true,
      name: true,
      code: true,
      assignedMarketer: { select: { id: true, name: true, email: true } },
    },
  });

  if (!client) redirect("/login");

  return (
    <PortalShell
      user={{ id: portalUser.id, name: portalUser.name, email: portalUser.email }}
      client={client}
    >
      {children}
    </PortalShell>
  );
}
