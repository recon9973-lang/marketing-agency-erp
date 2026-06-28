import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { MarketerDashboard } from "@/components/dashboard/MarketerDashboard";
import { SuperAdminDashboard } from "@/components/dashboard/SuperAdminDashboard";
import { summarizeDashboard, type DashboardInput } from "@/domain/dashboard";
import { BillingStatus, Role, WorkStatus } from "@/domain/types";
import type { CurrentUser } from "@/server/session";
import { getCurrentUser } from "@/server/session";

function getTemporaryDashboardInput(user: CurrentUser): DashboardInput {
  const roleScopedCounts = {
    [Role.SUPER_ADMIN]: { assignedClientCount: 18, leaveBalanceDays: 0 },
    [Role.ADMIN]: { assignedClientCount: 11, leaveBalanceDays: 0 },
    [Role.MARKETER]: { assignedClientCount: 8, leaveBalanceDays: 9 }
  } satisfies Record<Role, Pick<DashboardInput, "assignedClientCount" | "leaveBalanceDays">>;

  return {
    today: "2026-06-28",
    ...roleScopedCounts[user.role],
    workItems: [
      { status: WorkStatus.IN_PROGRESS, dueDate: "2026-06-20" },
      { status: WorkStatus.REVIEW_NEEDED, dueDate: "2026-06-28" },
      { status: WorkStatus.NOT_STARTED, dueDate: "2026-06-30", category: "MONTHLY_REPORT" },
      { status: WorkStatus.COMPLETED, dueDate: "2026-06-19" }
    ],
    billings: [
      { status: BillingStatus.OVERDUE, issuedAmount: 1800000, paidAmount: 300000 },
      { status: BillingStatus.PARTIALLY_PAID, issuedAmount: 900000, paidAmount: 500000 },
      { status: BillingStatus.PAID, issuedAmount: 700000, paidAmount: 700000 }
    ],
    expenses: [{ amount: 420000 }, { amount: 185000 }],
    leaveRequests: [{ status: "REQUESTED" }, { status: "APPROVED" }]
  };
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const summary = summarizeDashboard(getTemporaryDashboardInput(user));

  if (user.role === Role.SUPER_ADMIN) {
    return <SuperAdminDashboard summary={summary} />;
  }

  if (user.role === Role.ADMIN) {
    return <AdminDashboard summary={summary} />;
  }

  return <MarketerDashboard summary={summary} />;
}
