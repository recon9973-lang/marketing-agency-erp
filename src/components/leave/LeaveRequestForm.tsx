"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";
import { leaveTypeLabels } from "@/domain/leave";
import { LeaveType } from "@/domain/types";
import { createLeaveRequestAction } from "@/server/actions/leave";

const typeOptions = Object.values(LeaveType);

function fieldErrors(state: Awaited<ReturnType<typeof createLeaveRequestAction>> | null, name: string) {
  return state && !state.ok ? state.error.fieldErrors?.[name] : undefined;
}

export function LeaveRequestForm() {
  const [state, formAction, pending] = useActionState(createLeaveRequestAction, null);
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
    <form ref={formRef} action={formAction} className="space-y-4 rounded-md border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink">휴가 신청</h3>
        {state?.ok ? <span className="text-sm text-brand">신청이 접수되었습니다.</span> : null}
      </div>

      {formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">{formError}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        <FormField label="유형" required errors={fieldErrors(state, "type")}>
          {({ id, invalid, describedBy }) => (
            <Select id={id} name="type" defaultValue={LeaveType.ANNUAL} invalid={invalid} aria-describedby={describedBy}>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {leaveTypeLabels[type]}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="시작일" required errors={fieldErrors(state, "startDate")}>
          {({ id, invalid, describedBy }) => (
            <DateInput id={id} name="startDate" invalid={invalid} aria-describedby={describedBy} required />
          )}
        </FormField>

        <FormField label="종료일" required errors={fieldErrors(state, "endDate")}>
          {({ id, invalid, describedBy }) => (
            <DateInput id={id} name="endDate" invalid={invalid} aria-describedby={describedBy} required />
          )}
        </FormField>

        <FormField label="일수" required errors={fieldErrors(state, "daysRequested")}>
          {({ id, invalid, describedBy }) => (
            <NumberInput id={id} name="daysRequested" step={0.5} min={0.5} invalid={invalid} aria-describedby={describedBy} required />
          )}
        </FormField>

        <FormField label="사유" errors={fieldErrors(state, "reason")}>
          {({ id, invalid, describedBy }) => (
            <Input id={id} name="reason" invalid={invalid} aria-describedby={describedBy} />
          )}
        </FormField>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "신청 중…" : "휴가 신청"}
      </Button>
    </form>
  );
}
