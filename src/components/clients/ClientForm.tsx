"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, LinkButton } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { DateInput, Input, NumberInput, Select, Textarea } from "@/components/ui/fields";
import type { ActionResult } from "@/server/action-result";

export type MarketerOption = {
  id: string;
  name: string;
};

export type ClientFormValues = {
  name?: string;
  code?: string;
  businessNumber?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  monthlyContractFee?: string;
  serviceNotes?: string;
  assignedMarketerId?: string;
  active?: boolean;
};

type ClientFormAction = (
  prevState: ActionResult<{ id: string }> | null,
  formData: FormData
) => Promise<ActionResult<{ id: string }>>;

export function ClientForm({
  action,
  marketers,
  defaultValues,
  submitLabel
}: {
  action: ClientFormAction;
  marketers: MarketerOption[];
  defaultValues?: ClientFormValues;
  submitLabel: string;
}) {
  const router = useRouter();
  const [result, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (result?.ok) {
      router.push("/clients");
      router.refresh();
    }
  }, [result, router]);

  const fieldErrors = result && !result.ok ? (result.error.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="grid gap-4 rounded-md border border-line bg-white p-6 md:grid-cols-2">
      {result && !result.ok ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger md:col-span-2">
          {result.error.message}
        </div>
      ) : null}

      <FormField label="거래처명" required errors={fieldErrors.name}>
        <Input name="name" defaultValue={defaultValues?.name} invalid={Boolean(fieldErrors.name)} />
      </FormField>
      <FormField label="거래처 코드" required hint="영문, 숫자, 하이픈" errors={fieldErrors.code}>
        <Input name="code" defaultValue={defaultValues?.code} invalid={Boolean(fieldErrors.code)} />
      </FormField>

      <FormField label="사업자번호" errors={fieldErrors.businessNumber}>
        <Input name="businessNumber" defaultValue={defaultValues?.businessNumber} invalid={Boolean(fieldErrors.businessNumber)} />
      </FormField>
      <FormField label="담당자 배정" errors={fieldErrors.assignedMarketerId}>
        <Select
          name="assignedMarketerId"
          defaultValue={defaultValues?.assignedMarketerId ?? ""}
          invalid={Boolean(fieldErrors.assignedMarketerId)}
        >
          <option value="">미배정</option>
          {marketers.map((marketer) => (
            <option key={marketer.id} value={marketer.id}>
              {marketer.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="담당자 이름" errors={fieldErrors.contactName}>
        <Input name="contactName" defaultValue={defaultValues?.contactName} invalid={Boolean(fieldErrors.contactName)} />
      </FormField>
      <FormField label="연락 이메일" errors={fieldErrors.contactEmail}>
        <Input name="contactEmail" defaultValue={defaultValues?.contactEmail} invalid={Boolean(fieldErrors.contactEmail)} />
      </FormField>

      <FormField label="연락처" errors={fieldErrors.contactPhone}>
        <Input name="contactPhone" defaultValue={defaultValues?.contactPhone} invalid={Boolean(fieldErrors.contactPhone)} />
      </FormField>
      <FormField label="월 계약금 (원)" errors={fieldErrors.monthlyContractFee}>
        <NumberInput
          name="monthlyContractFee"
          min={0}
          step={1}
          defaultValue={defaultValues?.monthlyContractFee}
          invalid={Boolean(fieldErrors.monthlyContractFee)}
        />
      </FormField>

      <FormField label="계약 시작일" errors={fieldErrors.contractStartDate}>
        <DateInput name="contractStartDate" defaultValue={defaultValues?.contractStartDate} invalid={Boolean(fieldErrors.contractStartDate)} />
      </FormField>
      <FormField label="계약 종료일" errors={fieldErrors.contractEndDate}>
        <DateInput name="contractEndDate" defaultValue={defaultValues?.contractEndDate} invalid={Boolean(fieldErrors.contractEndDate)} />
      </FormField>

      <div className="md:col-span-2">
        <FormField label="서비스 메모" errors={fieldErrors.serviceNotes}>
          <Textarea name="serviceNotes" defaultValue={defaultValues?.serviceNotes} invalid={Boolean(fieldErrors.serviceNotes)} />
        </FormField>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600 md:col-span-2">
        <input
          type="checkbox"
          name="active"
          defaultChecked={defaultValues?.active ?? true}
          className="h-4 w-4 rounded border-line text-brand focus:ring-brand/30"
        />
        운영중 거래처
      </label>

      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : submitLabel}
        </Button>
        <LinkButton href="/clients">취소</LinkButton>
      </div>
    </form>
  );
}
