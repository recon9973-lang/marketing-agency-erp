"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, LinkButton } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { DateInput, Input, NumberInput, Select, Textarea } from "@/components/ui/fields";
import type { ActionResult } from "@/server/action-result";

export type WorkFormOption = {
  id: string;
  name: string;
};

export type WorkFormValues = {
  title?: string;
  clientId?: string;
  ownerId?: string;
  category?: string;
  priority?: string;
  dueDate?: string;
  progressNotes?: string;
};

type WorkFormAction = (
  prevState: ActionResult<{ id: string }> | null,
  formData: FormData
) => Promise<ActionResult<{ id: string }>>;

export function WorkForm({
  action,
  clients,
  owners,
  categories,
  defaultValues,
  submitLabel
}: {
  action: WorkFormAction;
  clients: WorkFormOption[];
  owners: WorkFormOption[];
  categories: Array<{ value: string; label: string }>;
  defaultValues?: WorkFormValues;
  submitLabel: string;
}) {
  const router = useRouter();
  const [result, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (result?.ok) {
      router.push("/work");
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

      <div className="md:col-span-2">
        <FormField label="업무명" required errors={fieldErrors.title}>
          <Input name="title" defaultValue={defaultValues?.title} invalid={Boolean(fieldErrors.title)} />
        </FormField>
      </div>

      <FormField label="거래처" required errors={fieldErrors.clientId}>
        <Select name="clientId" defaultValue={defaultValues?.clientId ?? ""} invalid={Boolean(fieldErrors.clientId)}>
          <option value="">거래처 선택</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="담당자" required errors={fieldErrors.ownerId}>
        <Select name="ownerId" defaultValue={defaultValues?.ownerId ?? ""} invalid={Boolean(fieldErrors.ownerId)}>
          <option value="">담당자 선택</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="카테고리" required errors={fieldErrors.category}>
        <Select name="category" defaultValue={defaultValues?.category ?? ""} invalid={Boolean(fieldErrors.category)}>
          <option value="">카테고리 선택</option>
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="우선순위" hint="1(높음) ~ 5(낮음)" errors={fieldErrors.priority}>
        <NumberInput name="priority" min={1} max={5} step={1} defaultValue={defaultValues?.priority ?? "3"} invalid={Boolean(fieldErrors.priority)} />
      </FormField>

      <FormField label="마감일" errors={fieldErrors.dueDate}>
        <DateInput name="dueDate" defaultValue={defaultValues?.dueDate} invalid={Boolean(fieldErrors.dueDate)} />
      </FormField>

      <div className="md:col-span-2">
        <FormField label="진행 메모" errors={fieldErrors.progressNotes}>
          <Textarea name="progressNotes" defaultValue={defaultValues?.progressNotes} invalid={Boolean(fieldErrors.progressNotes)} />
        </FormField>
      </div>

      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : submitLabel}
        </Button>
        <LinkButton href="/work">취소</LinkButton>
      </div>
    </form>
  );
}
