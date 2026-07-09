import { notFound, redirect } from "next/navigation";
import { ClientDetail } from "@/components/clients/ClientDetail";
import { CommentThread } from "@/components/collab/CommentThread";
import { Role } from "@/domain/types";
import { getClientDetail } from "@/server/repositories/clients";
import { getHospitalProfile } from "@/server/repositories/hospital-profile";
import { getLatestConsulting } from "@/server/repositories/consulting";
import { isAiConfigured } from "@/server/ai/claude";
import { getIndustryTree } from "@/server/repositories/masters";
import { listActiveMembers, listComments } from "@/server/repositories/collab";
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
  const [industries, marketers, comments, members, hospitalProfile, consultingReport] = await Promise.all([
    getIndustryTree(),
    db.user.findMany({ where: { role: Role.MARKETER, status: "ACTIVE" }, select: { id: true, name: true } }),
    listComments("CLIENT", id),
    listActiveMembers(),
    detail.client.businessType === "HOSPITAL" ? getHospitalProfile(id) : Promise.resolve(null),
    getLatestConsulting(id)
  ]);

  const consulting = {
    aiConfigured: isAiConfigured(),
    defaults: {
      hospitalName: detail.client.name,
      address: "",
      departments: hospitalProfile?.departments ?? ""
    },
    report: consultingReport
      ? {
          id: consultingReport.id,
          hospitalName: consultingReport.hospitalName,
          keywords: consultingReport.keywords,
          competitors: consultingReport.competitors,
          marketAnalysis: consultingReport.marketAnalysis,
          summary: consultingReport.summary,
          createdAt: consultingReport.createdAt
        }
      : null
  };

  return (
    <div className="space-y-6">
      <a href="/clients" className="text-sm font-semibold text-brand-strong hover:underline">← 거래처 목록</a>
      <ClientDetail
        client={detail.client}
        channels={detail.channels}
        works={detail.works}
        billings={detail.billings}
        reports={detail.reports}
        hospitalProfile={hospitalProfile}
        consulting={consulting}
        canViewFinance={canViewFinance}
        canManage={canManage}
        industries={industries}
        marketers={marketers}
      />
      <CommentThread
        targetType="CLIENT"
        targetId={id}
        initialComments={comments}
        members={members}
        currentUserId={user.id}
        canModerate={canManage}
      />
    </div>
  );
}
