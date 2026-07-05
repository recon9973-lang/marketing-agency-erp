import { notFound, redirect } from "next/navigation";
import { ClientDetail } from "@/components/clients/ClientDetail";
import { Role } from "@/domain/types";
import { getClientDetail } from "@/server/repositories/clients";
import { getIndustryTree } from "@/server/repositories/masters";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const detail = await getClientDetail(user, id);
  if (!detail) {
    notFound();
  }

  const canViewFinance = user.role !== Role.MARKETER;
  const canManage = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
  const [industries, marketers] = await Promise.all([
    getIndustryTree(),
    db.user.findMany({ where: { role: Role.MARKETER, status: "ACTIVE" }, select: { id: true, name: true } })
  ]);

  return (
    <div className="space-y-6">
      <a href="/clients" className="text-sm font-semibold text-brand-strong hover:underline">← 거래처 목록</a>
      <ClientDetail
        client={detail.client}
        channels={detail.channels}
        works={detail.works}
        billings={detail.billings}
        reports={detail.reports}
        canViewFinance={canViewFinance}
        canManage={canManage}
        industries={industries}
        marketers={marketers}
      />
    </div>
  );
}
