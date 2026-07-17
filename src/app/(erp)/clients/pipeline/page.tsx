// src/app/(erp)/clients/pipeline/page.tsx
// 거래처 영업 파이프라인 — Kanban 보드 (관리자/최고관리자)

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";
import Link from "next/link";
import { PipelineCard } from "@/components/erp/PipelineCard";

const STAGES: {
  status: string;
  label: string;
  color: string;
  bg: string;
  desc: string;
}[] = [
  {
    status: "PROSPECT",
    label: "잠재 고객",
    color: "text-slate-500",
    bg: "bg-slate-50 border-slate-200",
    desc: "리드 발굴 단계",
  },
  {
    status: "CONSULTING",
    label: "상담 중",
    color: "text-indigo-600",
    bg: "bg-indigo-50 border-indigo-200",
    desc: "초기 상담 진행",
  },
  {
    status: "MEETING",
    label: "미팅 진행",
    color: "text-sky-600",
    bg: "bg-sky-50 border-sky-200",
    desc: "대면/온라인 미팅",
  },
  {
    status: "NEGOTIATING",
    label: "계약 협의",
    color: "text-violet-600",
    bg: "bg-violet-50 border-violet-200",
    desc: "견적 및 계약 조율",
  },
  {
    status: "ACTIVE",
    label: "계약 활성",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
    desc: "서비스 진행 중",
  },
  {
    status: "PAUSED",
    label: "일시 중단",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    desc: "계약 일시 중지",
  },
  {
    status: "LOST",
    label: "이탈",
    color: "text-red-500",
    bg: "bg-red-50 border-red-200",
    desc: "계약 종료/이탈",
  },
];

export default async function ClientPipelinePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "MARKETER" || user.role === "CLIENT") redirect("/dashboard");

  const clients = await db.client.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      contactName: true,
      contactPhone: true,
      contractStartDate: true,
      monthlyContractFee: true,
      updatedAt: true,
      assignedMarketer: { select: { name: true } },
      stageAssignee: { select: { name: true } },
      _count: {
        select: {
          clientRequests: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } } },
          portalUsers: true,
        },
      },
    },
  });

  const byStatus = STAGES.reduce(
    (acc, stage) => {
      acc[stage.status] = clients.filter((c) => c.status === stage.status);
      return acc;
    },
    {} as Record<string, typeof clients>
  );

  const activeCount = byStatus["ACTIVE"]?.length ?? 0;
  const prospectCount = (byStatus["PROSPECT"]?.length ?? 0) +
    (byStatus["CONSULTING"]?.length ?? 0) +
    (byStatus["MEETING"]?.length ?? 0) +
    (byStatus["NEGOTIATING"]?.length ?? 0);

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">영업 파이프라인</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            계약 활성 {activeCount}개 · 진행 중 {prospectCount}개
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/clients"
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
          >
            목록 보기
          </Link>
        </div>
      </div>

      {/* Kanban 보드 — 수평 스크롤 */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4" style={{ minWidth: `${STAGES.length * 260}px` }}>
          {STAGES.map((stage) => {
            const stageClients = byStatus[stage.status] ?? [];
            return (
              <div key={stage.status} className="flex-shrink-0 w-60">
                {/* 컬럼 헤더 */}
                <div className={`rounded-xl border p-3 mb-3 ${stage.bg}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold ${stage.color}`}>
                      {stage.label}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white ${stage.color}`}
                    >
                      {stageClients.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{stage.desc}</p>
                </div>

                {/* 카드 목록 */}
                <div className="space-y-2">
                  {stageClients.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-300 border-2 border-dashed border-slate-100 rounded-xl">
                      없음
                    </div>
                  ) : (
                    stageClients.map((client) => (
                      <PipelineCard
                        key={client.id}
                        client={{
                          id: client.id,
                          name: client.name,
                          code: client.code,
                          contactName: client.contactName,
                          contractStartDate: client.contractStartDate?.toISOString() ?? null,
                          monthlyContractFee: client.monthlyContractFee
                            ? Number(client.monthlyContractFee)
                            : null,
                          updatedAt: client.updatedAt.toISOString(),
                          assignedMarketer: client.assignedMarketer,
                          stageAssignee: client.stageAssignee,
                          openRequestCount: client._count.clientRequests,
                          portalUserCount: client._count.portalUsers,
                        }}
                        stages={STAGES.map((s) => ({
                          value: s.status,
                          label: s.label,
                        }))}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
