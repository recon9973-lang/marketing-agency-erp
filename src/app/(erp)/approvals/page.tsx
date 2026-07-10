import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ApprovalQueue } from "@/components/approvals/ApprovalQueue";
import { Role } from "@/domain/types";
import { listPendingApprovals, listMyApprovalRequests } from "@/server/repositories/approvals";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canDecide = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
  const [pending, myRequests] = await Promise.all([
    canDecide ? listPendingApprovals() : Promise.resolve([]),
    listMyApprovalRequests(user.id)
  ]);

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="승인"
        title="통합 승인함"
        description="계약·견적·원고·콘텐츠 승인 요청을 한 곳에서 처리합니다. 승인/반려는 관리자 이상만 가능합니다."
      />
      <ApprovalQueue pending={pending} myRequests={myRequests} canDecide={canDecide} />
    </div>
  );
}
