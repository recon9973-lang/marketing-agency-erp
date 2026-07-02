"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { DateInput, Input, NumberInput, Select } from "@/components/ui/fields";
import type { ActionResult } from "@/server/action-result";

type LeaveRequestFormAction = (
  prevState: ActionResult<{ id: string }> | null,
  formData: FormData
) => Promise<ActionResult<{ id: string }>>;

export function LeaveRequestForm({
  action,
  typeOptions
}: {
  action: LeaveRequestFormAction;
  typeOptions: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [result, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (result?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [result, router]);

  const fieldErrors = result && !result.ok ? (result.error.fieldErrors ?? {}) : {};

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 rounded-md border border-line bg-white p-4 md:grid-cols-5">
      {result && !result.ok ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger md:col-span-5">
          {result.error.message}
        </div>
      ) : null}
      {result?.ok ? (
        <div className="rounded-md border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-brand md:col-span-5">
          휴가 신청이 접수되었습니다.
        </div>
      ) : null}

      <FormField label="유형" required errors={fieldErrors.type}>
        <Select name="type" invalid={Boolean(fieldErrors.type)}>
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="시작일" required errors={fieldErrors.startDate}>
        <DateInput name="startDate" invalid={Boolean(fieldErrors.startDate)} />
      </FormField>
      <FormField label="종료일" required errors={fieldErrors.endDate}>
        <DateInput name="endDate" invalid={Boolean(fieldErrors.endDate)} />
      </FormField>
      <FormField label="일수" required errors={fieldErrors.daysRequested}>
        <NumberInput name="daysRequested" step="0.5" min="0.5" invalid={Boolean(fieldErrors.daysRequested)} />
      </FormField>
      <FormField label="사유" errors={fieldErrors.reason}>
        <Input name="reason" invalid={Boolean(fieldErrors.reason)} />
      </FormField>

      <div className="flex items-end md:col-span-5">
        <Button type="submit" disabled={pending}>
          {pending ? "신청 중..." : "휴가 신청"}
        </Button>
      </div>
    </form>
  );
}
