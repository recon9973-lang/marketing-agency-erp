"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { payBillingDemoAction } from "@/server/actions/pay";

/** 데모 결제 버튼(공용 결제 페이지). 실 결제 미연동 시에만 노출. */
export function PayBillingButton({ billingRecordId }: { billingRecordId: string }) {
  const [state, formAction, pending] = useActionState(payBillingDemoAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="billingRecordId" value={billingRecordId} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "처리 중…" : "데모 결제하기"}
      </button>
      {state && !state.ok ? <p className="text-sm text-rose-600">{state.error.message}</p> : null}
      <p className="text-center text-xs text-slate-400">
        데모 결제입니다. 실제 카드 청구가 발생하지 않습니다.
      </p>
    </form>
  );
}
