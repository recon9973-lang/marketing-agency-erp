"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";
import { paymentMethodLabels } from "@/domain/finance";
import { PaymentMethod } from "@/domain/types";
import { recordPaymentAction, type FinanceActionState } from "@/server/actions/finance";

const methodOptions = Object.values(PaymentMethod);

function fieldErrors(state: FinanceActionState | null, name: string) {
  return state && !state.ok ? state.error.fieldErrors?.[name] : undefined;
}

export function PaymentForm({ billingRecordId }: { billingRecordId: string }) {
  const [state, formAction, pending] = useActionState(recordPaymentAction, null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const formError = state && !state.ok && !state.error.fieldErrors ? state.error.message : null;

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="billingRecordId" value={billingRecordId} />

      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink">입금 기록</h3>
        {state?.ok ? <span className="text-sm text-brand">입금이 반영되었습니다.</span> : null}
      </div>

      {formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">{formError}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <FormField label="입금액 (원)" required errors={fieldErrors(state, "amount")}>
          {({ id, invalid, describedBy }) => (
            <NumberInput id={id} name="amount" min={1} invalid={invalid} aria-describedby={describedBy} required />
          )}
        </FormField>

        <FormField label="결제수단" required errors={fieldErrors(state, "method")}>
          {({ id, invalid, describedBy }) => (
            <Select id={id} name="method" defaultValue={PaymentMethod.BANK_TRANSFER} invalid={invalid} aria-describedby={describedBy}>
              {methodOptions.map((method) => (
                <option key={method} value={method}>
                  {paymentMethodLabels[method]}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="입금일" required errors={fieldErrors(state, "receivedAt")}>
          {({ id, invalid, describedBy }) => (
            <DateInput id={id} name="receivedAt" invalid={invalid} aria-describedby={describedBy} required />
          )}
        </FormField>

        <FormField label="거래 번호" errors={fieldErrors(state, "transactionId")}>
          {({ id, invalid, describedBy }) => (
            <Input id={id} name="transactionId" invalid={invalid} aria-describedby={describedBy} />
          )}
        </FormField>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "기록 중…" : "입금 기록"}
      </Button>
    </form>
  );
}
