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
import type { ClientActionState } from "@/server/actions/clients";
import type { AssignableMarketer, ClientDetail } from "@/server/repositories/clients";

export type ClientFormAction = (
  prevState: ClientActionState | null,
  formData: FormData
) => Promise<ClientActionState>;

export type ClientFormProps = {
  action: ClientFormAction;
  marketers: AssignableMarketer[];
  initialValue?: ClientDetail;
  submitLabel: string;
};

function fieldErrors(state: ClientActionState | null, name: string) {
  return state && !state.ok ? state.error.fieldErrors?.[name] : undefined;
}

export function ClientForm({ action, marketers, initialValue, submitLabel }: ClientFormProps) {
  const [state, formAction, pending] = useActionState<ClientActionState | null, FormData>(action, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.push("/clients");
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
        <FormField label="거래처명" required errors={fieldErrors(state, "name")}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name="name"
              defaultValue={initialValue?.name ?? ""}
              invalid={invalid}
              aria-describedby={describedBy}
              required
            />
          )}
        </FormField>

        <FormField label="거래처 코드" required errors={fieldErrors(state, "code")} hint="조직 내 고유 코드">
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name="code"
              defaultValue={initialValue?.code ?? ""}
              invalid={invalid}
              aria-describedby={describedBy}
              required
            />
          )}
        </FormField>

        <FormField label="담당자" errors={fieldErrors(state, "assignedMarketerId")}>
          {({ id, invalid, describedBy }) => (
            <Select
              id={id}
              name="assignedMarketerId"
              defaultValue={initialValue?.assignedMarketerId ?? ""}
              invalid={invalid}
              aria-describedby={describedBy}
            >
              <option value="">미배정</option>
              {marketers.map((marketer) => (
                <option key={marketer.id} value={marketer.id}>
                  {marketer.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="월 계약금 (원)" errors={fieldErrors(state, "monthlyContractFee")}>
          {({ id, invalid, describedBy }) => (
            <NumberInput
              id={id}
              name="monthlyContractFee"
              min={0}
              step={1}
              defaultValue={initialValue?.monthlyContractFee ?? ""}
              invalid={invalid}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <FormField label="사업자번호" errors={fieldErrors(state, "businessNumber")}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name="businessNumber"
              defaultValue={initialValue?.businessNumber ?? ""}
              invalid={invalid}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <FormField label="담당자명 (거래처측)" errors={fieldErrors(state, "contactName")}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name="contactName"
              defaultValue={initialValue?.contactName ?? ""}
              invalid={invalid}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <FormField label="연락 이메일" errors={fieldErrors(state, "contactEmail")}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name="contactEmail"
              type="email"
              defaultValue={initialValue?.contactEmail ?? ""}
              invalid={invalid}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <FormField label="연락 전화" errors={fieldErrors(state, "contactPhone")}>
          {({ id, invalid, describedBy }) => (
            <Input
              id={id}
              name="contactPhone"
              defaultValue={initialValue?.contactPhone ?? ""}
              invalid={invalid}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <FormField label="계약 시작일" errors={fieldErrors(state, "contractStartDate")}>
          {({ id, invalid, describedBy }) => (
            <DateInput
              id={id}
              name="contractStartDate"
              defaultValue={initialValue?.contractStartDate ?? ""}
              invalid={invalid}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <FormField label="계약 종료일" errors={fieldErrors(state, "contractEndDate")}>
          {({ id, invalid, describedBy }) => (
            <DateInput
              id={id}
              name="contractEndDate"
              defaultValue={initialValue?.contractEndDate ?? ""}
              invalid={invalid}
              aria-describedby={describedBy}
            />
          )}
        </FormField>
      </div>

      <FormField label="서비스 메모" errors={fieldErrors(state, "serviceNotes")}>
        {({ id, invalid, describedBy }) => (
          <Textarea
            id={id}
            name="serviceNotes"
            defaultValue={initialValue?.serviceNotes ?? ""}
            invalid={invalid}
            aria-describedby={describedBy}
          />
        )}
      </FormField>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="hidden" name="active" value="false" />
        <input
          type="checkbox"
          name="active"
          value="true"
          defaultChecked={initialValue ? initialValue.active : true}
          className="h-4 w-4 rounded border-line text-brand focus:ring-brand/30"
        />
        운영중
      </label>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중…" : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/clients")} disabled={pending}>
          취소
        </Button>
      </div>
    </form>
  );
}
