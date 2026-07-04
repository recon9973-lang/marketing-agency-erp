import { notFound } from "next/navigation";
import { PayBillingButton } from "@/components/finance/PayBillingButton";
import { BillingStatus } from "@/domain/types";
import { tossClientKey, tossConfigured } from "@/server/integrations/toss";
import { getBillingForPayment } from "@/server/repositories/finance";

const monthFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });

function formatKRW(amount: number, currency: string) {
  if (currency === "KRW") return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
  return `${new Intl.NumberFormat("ko-KR").format(amount)} ${currency}`;
}

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const billing = await getBillingForPayment(id);

  if (!billing) {
    notFound();
  }

  const paid = billing.status === BillingStatus.PAID || billing.outstanding <= 0;
  const configured = tossConfigured();
  const hasClientKey = Boolean(tossClientKey());

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="bg-slate-900 px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">VENOM 마케팅</p>
          <h1 className="mt-1 text-lg font-semibold">결제 요청</h1>
        </div>

        <div className="space-y-4 px-6 py-6">
          <div className="space-y-1">
            <p className="text-sm text-slate-500">{billing.clientName}</p>
            <p className="text-sm text-slate-500">
              {monthFormatter.format(new Date(`${billing.billingMonth}T00:00:00`))} 마케팅 대금
              {billing.invoiceNumber ? ` · ${billing.invoiceNumber}` : ""}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-500">결제 금액</span>
              <span className="text-2xl font-bold text-slate-900">
                {formatKRW(paid ? billing.issuedAmount : billing.outstanding, billing.currency)}
              </span>
            </div>
            {billing.paidAmount > 0 && !paid ? (
              <p className="mt-1 text-right text-xs text-slate-400">
                (청구 {formatKRW(billing.issuedAmount, billing.currency)} 중 일부 입금됨)
              </p>
            ) : null}
            {billing.dueDate ? <p className="mt-1 text-xs text-slate-400">납기 {billing.dueDate}</p> : null}
          </div>

          {paid ? (
            <div className="rounded-lg bg-emerald-50 px-4 py-6 text-center">
              <p className="text-lg font-bold text-emerald-700">✅ 결제가 완료되었습니다</p>
              <p className="mt-1 text-sm text-emerald-600">이용해 주셔서 감사합니다.</p>
            </div>
          ) : configured ? (
            <div className="space-y-2">
              <button
                type="button"
                disabled={!hasClientKey}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-bold text-white disabled:opacity-60"
              >
                카드로 결제하기 (토스)
              </button>
              <p className="text-center text-xs text-slate-400">
                {hasClientKey
                  ? "토스 결제창이 열립니다."
                  : "TOSS_CLIENT_KEY를 설정하면 결제창이 활성화됩니다."}
              </p>
            </div>
          ) : (
            <PayBillingButton billingRecordId={billing.id} />
          )}
        </div>
      </div>
    </main>
  );
}
