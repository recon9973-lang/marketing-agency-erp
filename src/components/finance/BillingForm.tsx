"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";
import type { FinanceActionState } from "@/server/actions/finance";
import type { BillingDetail } from "@/server/repositories/finance";

export type BillingFormOption = { id: string; name: string };

export type BillingFormProps = {
  action: (prevState: FinanceActionState | null, formData: FormData) => Promise<FinanceActionState>;
  clients: BillingFormOption[];
  initialValue?: BillingDetail;
  submitLabel: string;
};

function fieldErrors(state: FinanceActionState | null, name: string) {
  return state && !state.ok ? state.error.fieldErrors?.[name] : undefined;
}

export function BillingForm({ action, clients, initialValue, submitLabel }: BillingFormProps) {
  const [state, formAction, pending] = useActionState<FinanceActionState | null, FormData>(action, null);
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
      {initialValue ? <input type="hidden" name="id" value={initialValue.id} /> : null}

      {formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">{formError}</p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <FormField label="거래처" required errors={fieldErrors(state, "clientId")}>
          {({ id, invalid, describedBy }) => (
            <Select id={id} name="clientId" defaultValue={initialValue?.clientId ?? ""} invalid={invalid} aria-describedby={describedBy} placeholder="거래처 선택">
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="청구월" required errors={fieldErrors(state, "billingMonth")} hint="해당 월의 날짜(예: 2026-06-01)">
          {({ id, invalid, describedBy }) => (
            <DateInput id={id} name="billingMonth" defaultValue={initialValue?.billingMonth ?? ""} invalid={invalid} aria-describedby={describedBy} required />
          )}
        </FormField>

        <FormField label="계약금액 (원)" required errors={fieldErrors(state, "contractAmount")}>
          {({ id, invalid, describedBy }) => (
            <NumberInput id={id} name="contractAmount" min={0} defaultValue={initialValue?.contractAmount ?? ""} invalid={invalid} aria-describedby={describedBy} required />
          )}
        </FormField>

        <FormField label="청구금액 (원)" required errors={fieldErrors(state, "issuedAmount")}>
          {({ id, invalid, describedBy }) => (
            <NumberInput id={id} name="issuedAmount" min={0} defaultValue={initialValue?.issuedAmount ?? ""} invalid={invalid} aria-describedby={describedBy} required />
          )}
        </FormField>

        <FormField label="입금기한" errors={fieldErrors(state, "dueDate")}>
          {({ id, invalid, describedBy }) => (
            <DateInput id={id} name="dueDate" defaultValue={initialValue?.dueDate ?? ""} invalid={invalid} aria-describedby={describedBy} />
          )}
        </FormField>

        <FormField label="인보이스 번호" errors={fieldErrors(state, "invoiceNumber")}>
          {({ id, invalid, describedBy }) => (
            <Input id={id} name="invoiceNumber" defaultValue={initialValue?.invoiceNumber ?? ""} invalid={invalid} aria-describedby={describedBy} />
          )}
        </FormField>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중…" : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/finance")} disabled={pending}>
          취소
        </Button>
      </div>
    </form>
  );
}
