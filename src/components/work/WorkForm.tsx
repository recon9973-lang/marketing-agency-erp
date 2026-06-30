"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { workCategoryLabels } from "@/domain/work";
import { WorkCategory } from "@/domain/types";
import type { WorkActionState } from "@/server/actions/work";
import type { WorkItemDetail } from "@/server/repositories/work";

export type WorkOption = { id: string; name: string };

export type WorkFormProps = {
  action: (prevState: WorkActionState | null, formData: FormData) => Promise<WorkActionState>;
  clients: WorkOption[];
  marketers: WorkOption[];
  initialValue?: WorkItemDetail;
  submitLabel: string;
};

const categoryOptions = Object.values(WorkCategory);
const priorityOptions = [1, 2, 3, 4, 5];

function fieldErrors(state: WorkActionState | null, name: string) {
  return state && !state.ok ? state.error.fieldErrors?.[name] : undefined;
}

export function WorkForm({ action, clients, marketers, initialValue, submitLabel }: WorkFormProps) {
  const [state, formAction, pending] = useActionState<WorkActionState | null, FormData>(action, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.push("/work");
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

      <FormField label="업무명" required errors={fieldErrors(state, "title")}>
        {({ id, invalid, describedBy }) => (
          <Input id={id} name="title" defaultValue={initialValue?.title ?? ""} invalid={invalid} aria-describedby={describedBy} required />
        )}
      </FormField>

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

        <FormField label="담당자" required errors={fieldErrors(state, "ownerId")}>
          {({ id, invalid, describedBy }) => (
            <Select id={id} name="ownerId" defaultValue={initialValue?.ownerId ?? ""} invalid={invalid} aria-describedby={describedBy} placeholder="담당자 선택">
              {marketers.map((marketer) => (
                <option key={marketer.id} value={marketer.id}>
                  {marketer.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="카테고리" required errors={fieldErrors(state, "category")}>
          {({ id, invalid, describedBy }) => (
            <Select id={id} name="category" defaultValue={initialValue?.category ?? ""} invalid={invalid} aria-describedby={describedBy} placeholder="카테고리 선택">
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {workCategoryLabels[category]}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="우선순위" required errors={fieldErrors(state, "priority")} hint="1(낮음) ~ 5(높음)">
          {({ id, invalid, describedBy }) => (
            <Select id={id} name="priority" defaultValue={String(initialValue?.priority ?? 3)} invalid={invalid} aria-describedby={describedBy}>
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="마감일" errors={fieldErrors(state, "dueDate")}>
          {({ id, invalid, describedBy }) => (
            <DateInput id={id} name="dueDate" defaultValue={initialValue?.dueDate ?? ""} invalid={invalid} aria-describedby={describedBy} />
          )}
        </FormField>
      </div>

      <FormField label="진행 메모" errors={fieldErrors(state, "progressNotes")}>
        {({ id, invalid, describedBy }) => (
          <Textarea id={id} name="progressNotes" defaultValue={initialValue?.progressNotes ?? ""} invalid={invalid} aria-describedby={describedBy} />
        )}
      </FormField>

      <FormField label="결과 요약" errors={fieldErrors(state, "resultSummary")}>
        {({ id, invalid, describedBy }) => (
          <Textarea id={id} name="resultSummary" defaultValue={initialValue?.resultSummary ?? ""} invalid={invalid} aria-describedby={describedBy} />
        )}
      </FormField>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중…" : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/work")} disabled={pending}>
          취소
        </Button>
      </div>
    </form>
  );
}
