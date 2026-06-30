"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { paymentMethodLabels } from "@/domain/finance";
import { PaymentMethod } from "@/domain/types";
import { createExpenseRecordAction, type FinanceActionState } from "@/server/actions/finance";

export type ExpenseFormOption = { id: string; name: string };

const methodOptions = Object.values(PaymentMethod);

function fieldErrors(state: FinanceActionState | null, name: string) {
  return state && !state.ok ? state.error.fieldErrors?.[name] : undefined;
}

export function ExpenseForm({ clients }: { clients: ExpenseFormOption[] }) {
  const [state, formAction, pending] = useActionState(createExpenseRecordAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.push("/finance");
      router.refresh();
    }
  }, [state, router]);

  const formError = state && !state.ok && !state.error.fieldErrors ? state.error.message : null;

  return (
    <form action={formAction} className="space-y-5">
      {formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">{formError}</p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="지출 분류" required errors={fieldErrors(state, "category")}>
          {({ id, invalid, describedBy }) => (
            <Input id={id} name="category" invalid={invalid} aria-describedby={describedBy} required />
          )}
        </FormField>

        <FormField label="지출처" errors={fieldErrors(state, "vendor")}>
          {({ id, invalid, describedBy }) => (
            <Input id={id} name="vendor" invalid={invalid} aria-describedby={describedBy} />
          )}
        </FormField>

        <FormField label="관련 거래처" errors={fieldErrors(state, "clientId")} hint="공통 지출이면 비워둡니다">
          {({ id, invalid, describedBy }) => (
            <Select id={id} name="clientId" defaultValue="" invalid={invalid} aria-describedby={describedBy}>
              <option value="">공통</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="결제수단" required errors={fieldErrors(state, "paymentMethod")}>
          {({ id, invalid, describedBy }) => (
            <Select id={id} name="paymentMethod" defaultValue={PaymentMethod.CARD} invalid={invalid} aria-describedby={describedBy}>
              {methodOptions.map((method) => (
                <option key={method} value={method}>
                  {paymentMethodLabels[method]}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="금액 (원)" required errors={fieldErrors(state, "amount")}>
          {({ id, invalid, describedBy }) => (
            <NumberInput id={id} name="amount" min={1} invalid={invalid} aria-describedby={describedBy} required />
          )}
        </FormField>

        <FormField label="부가세 (원)" errors={fieldErrors(state, "taxAmount")}>
          {({ id, invalid, describedBy }) => (
            <NumberInput id={id} name="taxAmount" min={0} invalid={invalid} aria-describedby={describedBy} />
          )}
        </FormField>

        <FormField label="지출일" errors={fieldErrors(state, "paidAt")}>
          {({ id, invalid, describedBy }) => (
            <DateInput id={id} name="paidAt" invalid={invalid} aria-describedby={describedBy} />
          )}
        </FormField>
      </div>

      <FormField label="메모" errors={fieldErrors(state, "memo")}>
        {({ id, invalid, describedBy }) => (
          <Textarea id={id} name="memo" invalid={invalid} aria-describedby={describedBy} />
        )}
      </FormField>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중…" : "지출 등록"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/finance")} disabled={pending}>
          취소
        </Button>
      </div>
    </form>
  );
}
