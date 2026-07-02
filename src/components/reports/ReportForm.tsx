"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { ReportActionState } from "@/server/actions/report";
import type { ReportDetail } from "@/server/repositories/reports";

export type ReportFormOption = { id: string; name: string };

export type ReportFormProps = {
  action: (prevState: ReportActionState | null, formData: FormData) => Promise<ReportActionState>;
  clients: ReportFormOption[];
  initialValue?: ReportDetail;
  submitLabel: string;
};

function fieldErrors(state: ReportActionState | null, name: string) {
  return state && !state.ok ? state.error.fieldErrors?.[name] : undefined;
}

export function ReportForm({ action, clients, initialValue, submitLabel }: ReportFormProps) {
  const [state, formAction, pending] = useActionState<ReportActionState | null, FormData>(action, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.push("/reports");
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

        <FormField label="보고월" required errors={fieldErrors(state, "reportingMonth")} hint="해당 월의 날짜(예: 2026-06-01)">
          {({ id, invalid, describedBy }) => (
            <DateInput id={id} name="reportingMonth" defaultValue={initialValue?.reportingMonth ?? ""} invalid={invalid} aria-describedby={describedBy} required />
          )}
        </FormField>
      </div>

      <FormField label="제목" required errors={fieldErrors(state, "title")}>
        {({ id, invalid, describedBy }) => (
          <Input id={id} name="title" defaultValue={initialValue?.title ?? ""} invalid={invalid} aria-describedby={describedBy} required />
        )}
      </FormField>

      <FormField label="내용/메모" errors={fieldErrors(state, "notes")}>
        {({ id, invalid, describedBy }) => (
          <Textarea id={id} name="notes" rows={6} defaultValue={initialValue?.notes ?? ""} invalid={invalid} aria-describedby={describedBy} />
        )}
      </FormField>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중…" : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/reports")} disabled={pending}>
          취소
        </Button>
      </div>
    </form>
  );
}
