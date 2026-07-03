import { redirect } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { BankReconcile } from "@/components/finance/BankReconcile";
import { billingStatusLabels, expenseReviewStatusLabels, paymentMethodLabels } from "@/domain/finance";
import { ConnectionStatus, FinancialAccountType, Role } from "@/domain/types";
import {
  fetchFinanceOverviewForUser,
  getBankMatchSuggestions,
  type BillingListItem,
  type ExpenseListItem,
  type FinancialAccountListItem
} from "@/server/repositories/finance";
import { getCurrentUser } from "@/server/session";

const moneyFormatter = new Intl.NumberFormat("ko-KR");
const monthFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });
const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });

function formatMoney(value: number) {
  return `${moneyFormatter.format(value)}원`;
}

function formatDate(value: Date | null) {
  return value ? dateFormatter.format(value) : "-";
}

function connectionLabel(status: ConnectionStatus) {
  if (status === ConnectionStatus.CONNECTED) return "연결됨";
  if (status === ConnectionStatus.ERROR) return "확인필요";
  return "연동 준비";
}

function AccountCard({ account }: { account: FinancialAccountListItem }) {
  const last4 = account.accountLast4 ?? account.cardLast4 ?? "----";

  return (
    <div className="rounded-md border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{account.type === FinancialAccountType.BANK ? "계좌" : "카드"}</p>
          <p className="mt-1 font-semibold text-ink">{account.displayName}</p>
          <p className="mt-1 text-sm text-slate-500">
            {account.institutionName ?? "기관 미등록"} · {last4}
          </p>
        </div>
        <span className="rounded-md border border-line bg-surface px-3 py-1 text-xs font-semibold text-slate-600">{connectionLabel(account.connectionStatus)}</span>
      </div>
    </div>
  );
}

const billingColumns: DataTableColumn<BillingListItem>[] = [
  {
    key: "client",
    header: "거래처",
    render: (billing) => (
      <div>
        <p className="font-medium text-ink">{billing.clientName}</p>
        <p className="mt-1 text-xs text-slate-500">{billing.invoiceNumber ?? "수기 청구"}</p>
      </div>
    )
  },
  {
    key: "month",
    header: "청구월",
    render: (billing) => monthFormatter.format(billing.billingMonth)
  },
  {
    key: "issued",
    header: "청구액",
    render: (billing) => formatMoney(billing.issuedAmount)
  },
  {
    key: "paid",
    header: "입금액",
    render: (billing) => formatMoney(billing.paidAmount)
  },
  {
    key: "status",
    header: "상태",
    render: (billing) => <span className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-slate-700">{billingStatusLabels[billing.status]}</span>
  },
  {
    key: "due",
    header: "입금기한",
    render: (billing) => formatDate(billing.dueDate)
  }
];

const expenseColumns: DataTableColumn<ExpenseListItem>[] = [
  {
    key: "vendor",
    header: "지출처",
    render: (expense) => (
      <div>
        <p className="font-medium text-ink">{expense.vendor ?? "미기재"}</p>
        <p className="mt-1 text-xs text-slate-500">{expense.category}</p>
      </div>
    )
  },
  {
    key: "client",
    header: "관련 거래처",
    render: (expense) => expense.clientName ?? "공통"
  },
  {
    key: "amount",
    header: "금액",
    render: (expense) => formatMoney(expense.amount)
  },
  {
    key: "method",
    header: "결제수단",
    render: (expense) => paymentMethodLabels[expense.paymentMethod]
  },
  {
    key: "account",
    header: "연동 계좌/카드",
    render: (expense) => expense.accountLabel ?? "미연동"
  },
  {
    key: "review",
    header: "검토",
    render: (expense) => <span className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-slate-700">{expenseReviewStatusLabels[expense.reviewStatus]}</span>
  }
];

export default async function FinancePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const canReconcile = user.role !== Role.MARKETER;
  const [overview, bankSuggestions] = await Promise.all([
    fetchFinanceOverviewForUser(user),
    canReconcile ? getBankMatchSuggestions(user) : Promise.resolve([])
  ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand">정산/지출</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">거래처 입금 및 회사 지출 관리</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            V1은 PG 없이 수기 청구/입금 상태를 관리하고, 계좌·카드 지출 연동을 위한 기준 데이터를 함께 보여줍니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md border border-line bg-white px-4 py-3">
            <p className="text-xs text-slate-500">미수금</p>
            <p className="mt-1 font-semibold text-danger">{formatMoney(overview.unpaidAmount)}</p>
          </div>
          <div className="rounded-md border border-line bg-white px-4 py-3">
            <p className="text-xs text-slate-500">검토 지출</p>
            <p className="mt-1 font-semibold text-ink">{formatMoney(overview.reviewedExpenseAmount)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {overview.accounts.length > 0 ? (
          overview.accounts.map((account) => <AccountCard key={account.id} account={account} />)
        ) : (
          <div className="rounded-md border border-line bg-white p-4 text-sm text-slate-500">등록된 지출 연동 계좌/카드가 없습니다.</div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-ink">거래처 청구/입금</h3>
        <DataTable columns={billingColumns} rows={overview.billings} emptyMessage="조회 가능한 청구 내역이 없습니다." />
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-ink">회사 지출</h3>
        <DataTable columns={expenseColumns} rows={overview.expenses} emptyMessage="조회 가능한 지출 내역이 없습니다." />
      </div>

      {canReconcile && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-ink">입금 반자동 대사</h3>
          <div className="rounded-md border border-line bg-white p-4">
            <BankReconcile suggestions={bankSuggestions} />
          </div>
        </div>
      )}
    </section>
  );
}
