import Link from "next/link";
import { notFound } from "next/navigation";
import { confirmAndRecordToss } from "@/server/payments/toss-complete";
import { getBillingForPayment } from "@/server/repositories/finance";

type SearchParams = {
  paymentKey?: string;
  orderId?: string;
  amount?: string;
  code?: string;
  message?: string;
};

export default async function PayCompletePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const billing = await getBillingForPayment(id);
  if (!billing) {
    notFound();
  }

  // 실패 콜백(failUrl)은 code/message를 담아 돌아온다.
  let ok = false;
  let message: string;

  if (query.code) {
    message = query.message || "결제가 취소되었거나 실패했습니다.";
  } else if (query.paymentKey && query.orderId && query.amount) {
    const result = await confirmAndRecordToss({
      billingId: id,
      paymentKey: query.paymentKey,
      orderId: query.orderId,
      amount: Number(query.amount)
    });
    ok = result.ok;
    message = result.ok
      ? result.duplicate
        ? "이미 처리된 결제입니다."
        : "결제가 정상 승인되었습니다."
      : result.reason;
  } else {
    message = "결제 정보가 없습니다.";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="bg-slate-900 px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">VENOM 마케팅</p>
          <h1 className="mt-1 text-lg font-semibold">결제 결과</h1>
        </div>
        <div className="space-y-4 px-6 py-8 text-center">
          <p className="text-sm text-slate-500">
            {billing.clientName}
            {billing.invoiceNumber ? ` · ${billing.invoiceNumber}` : ""}
          </p>
          <div className={`rounded-lg px-4 py-6 ${ok ? "bg-emerald-50" : "bg-rose-50"}`}>
            <p className={`text-lg font-bold ${ok ? "text-emerald-700" : "text-rose-700"}`}>
              {ok ? "✅ 결제 완료" : "결제 실패"}
            </p>
            <p className={`mt-1 text-sm ${ok ? "text-emerald-600" : "text-rose-600"}`}>{message}</p>
          </div>
          <Link href={`/pay/${id}`} className="inline-block text-sm font-semibold text-blue-600 hover:underline">
            결제 페이지로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
