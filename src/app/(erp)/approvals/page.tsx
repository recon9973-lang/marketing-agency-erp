import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ApprovalQueue } from "@/components/approvals/ApprovalQueue";
import { Role } from "@/domain/types";
import { listPendingApprovalsForRole, listMyApprovalRequests } from "@/server/repositories/approvals";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // 승인함(결재 대기함)은 관리자 이상만 접근.
  const isAdmin = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
  if (!isAdmin) redirect("/dashboard");

  const [pending, myRequests] = await Promise.all([
    listPendingApprovalsForRole(user.role, user.id),
    listMyApprovalRequests(user.id)
  ]);

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="결재"
        title="승인함 (결재)"
        description="담당자→관리자→최고관리자 순으로 결재합니다. 관리자는 1차 검토 후 최고관리자에게 상신되고, 최고관리자가 최종 승인합니다."
      />
      <ApprovalQueue pending={pending} myRequests={myRequests} canDecide={isAdmin} />
    </div>
  );
}
