import { notFound, redirect } from "next/navigation";
import { ClientDetail } from "@/components/clients/ClientDetail";
import { ClientStageBar } from "@/components/clients/ClientStageBar";
import { ClientJourney } from "@/components/clients/ClientJourney";
import { getClientJourney } from "@/server/repositories/journey";
import { suggestNextStage, toClientStage } from "@/domain/sales/client-stages";
import { GoogleIntegrationPanel } from "@/components/clients/GoogleIntegrationPanel";
import { isGoogleConfigured } from "@/server/integrations/google";
import { CommentThread } from "@/components/collab/CommentThread";
import { Role } from "@/domain/types";
import { getClientDetail } from "@/server/repositories/clients";
import { getHospitalProfile } from "@/server/repositories/hospital-profile";
import { getLatestConsulting } from "@/server/repositories/consulting";
import { listQuotes } from "@/server/repositories/quotes";
import { listContentPlans } from "@/server/repositories/content-plans";
import { getExposureTracker } from "@/server/repositories/exposure";
import { isIntegrationConfigured } from "@/server/integrations/status";
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
  const [quotes, contentPlans, googleConnection, exposure, journey] = await Promise.all([
    listQuotes(id),
    listContentPlans(id),
    db.channelConnection
      .findUnique({
        where: { clientId_provider: { clientId: id, provider: "GOOGLE" } },
        select: { status: true, gscSiteUrl: true, ga4PropertyId: true, lastSyncAt: true, lastError: true }
      })
      .catch(() => null),
    getExposureTracker(id),
    getClientJourney(id).catch(() => [])
  ]);

  // Phase 4 — 데이터 신호로 다음 단계를 "제안"(사람 확인 후 이동). journey는 8단계 마일스톤.
  const stageSignals = {
    hasKeywords: journey.some((e) => e.stage === 6),
    hasGeoMonitoring: journey.some((e) => e.stage === 7),
    hasContentPlan: contentPlans.length > 0,
    hasPublished: journey.some((e) => e.stage === 8)
  };
  const suggestedStage = suggestNextStage(toClientStage(detail.client.stage), stageSignals);

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
      : null,
    quotes
  };

  return (
    <div className="space-y-6">
      <a href="/clients" className="text-sm font-semibold text-brand-strong hover:underline">← 거래처 목록</a>
      <ClientStageBar clientId={id} stage={detail.client.stage} canManage={canManage} suggested={suggestedStage} />
      <ClientJourney events={journey} />
      <ClientDetail
        client={detail.client}
        channels={detail.channels}
        works={detail.works}
        billings={detail.billings}
        reports={detail.reports}
        hospitalProfile={hospitalProfile}
        consulting={consulting}
        contentPlans={contentPlans}
        canViewFinance={canViewFinance}
        canManage={canManage}
        industries={industries}
        marketers={marketers}
        exposure={exposure}
        rankConnected={isIntegrationConfigured("naverResearch")}
      />
      <GoogleIntegrationPanel
        clientId={id}
        googleConfigured={isGoogleConfigured()}
        connection={
          googleConnection
            ? {
                status: googleConnection.status,
                gscSiteUrl: googleConnection.gscSiteUrl,
                ga4PropertyId: googleConnection.ga4PropertyId,
                lastSyncAt: googleConnection.lastSyncAt?.toISOString() ?? null,
                lastError: googleConnection.lastError
              }
            : null
        }
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
