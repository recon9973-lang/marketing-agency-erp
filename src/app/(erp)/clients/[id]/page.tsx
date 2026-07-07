// 거래처 상세 페이지 — 서버 컴포넌트에서 조회/권한검증 후 ClientDetail 에 주입.
// 탭: 기본정보 / 채널계정(자격증명 열람) / 업무 / 입금(재무) / 보고서.
import { notFound } from "next/navigation";
import { ClientDetail } from "@/components/clients/ClientDetail";
import { canAccessClient } from "@/domain/access-control";
import { Role } from "@/domain/types";
import { db } from "@/server/db";
import { getAdminScopes } from "@/server/actions/_helpers";
import { getCurrentUser } from "@/server/session";

const monthFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });
const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null; // 미들웨어에서 /login 리다이렉트 전제
  const { id } = await params;

  const client = await db.client.findUnique({
    where: { id },
    include: {
      assignedMarketer: { select: { name: true } },
      industryCategory: { select: { name: true, parent: { select: { name: true } } } }
    }
  });
  if (!client) notFound();

  // 권한: 마케터=본인 배정, 관리자=범위, 최고관리자=전체
  const scopes = user.role === Role.ADMIN ? await getAdminScopes(user) : [];
  if (!canAccessClient(user, client.id, scopes, client.assignedMarketerId)) notFound();

  const canViewFinance = user.role !== Role.MARKETER;

  const [accounts, works, billings] = await Promise.all([
    db.clientAccount.findMany({
      where: { clientId: id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: {
        id: true, label: true, externalUrl: true, usernameEnc: true, passwordEnc: true,
        channelType: { select: { name: true } }, platform: true
      }
    }),
    db.workItem.findMany({
      where: { clientId: id },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      select: { id: true, title: true, status: true, dueDate: true }
    }),
    canViewFinance
      ? db.billingRecord.findMany({
          where: { clientId: id },
          orderBy: { billingMonth: "desc" },
          select: { id: true, billingMonth: true, issuedAmount: true, paidAmount: true, status: true }
        })
      : Promise.resolve([])
  ]);

  const channels = accounts.map((a) => ({
    id: a.id,
    label: a.label,
    channelName: a.channelType?.name ?? a.platform ?? "채널",
    externalUrl: a.externalUrl,
    hasCredentials: Boolean(a.usernameEnc || a.passwordEnc)
  }));

  const workRows = works.map((w) => ({
    id: w.id,
    title: w.title,
    status: w.status,
    dueDate: w.dueDate ? dateFormatter.format(w.dueDate) : null
  }));

  const billingRows = billings.map((b) => ({
    id: b.id,
    billingMonth: monthFormatter.format(b.billingMonth),
    issuedAmount: Number(b.issuedAmount),
    paidAmount: Number(b.paidAmount),
    status: b.status
  }));

  return (
    <div className="p-6">
      <ClientDetail
        client={{
          id: client.id,
          name: client.name,
          code: client.code,
          industryName: client.industryCategory?.name ?? client.industryCategory?.parent?.name ?? null,
          assignedMarketerName: client.assignedMarketer?.name ?? null,
          active: client.active
        }}
        channels={channels}
        works={workRows}
        billings={billingRows}
        canViewFinance={canViewFinance}
      />
    </div>
  );
}
