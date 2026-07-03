"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { NumberInput } from "@/components/ui/NumberInput";
import { recordPlaceRankAction } from "@/server/actions/place-rank";

function fieldErrors(state: Awaited<ReturnType<typeof recordPlaceRankAction>> | null, name: string) {
  return state && !state.ok ? state.error.fieldErrors?.[name] : undefined;
}

export function PlaceRankForm({ clientId, keywords }: { clientId: string; keywords: string[] }) {
  const [state, formAction, pending] = useActionState(recordPlaceRankAction, null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);

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
        <h3 className="text-base font-semibold text-ink">순위 기록</h3>
        {state?.ok ? <span className="text-sm text-brand">기록되었습니다.</span> : null}
      </div>

      {formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">{formError}</p>
      ) : null}

      <input type="hidden" name="clientId" value={clientId} />

      <div className="grid gap-4 md:grid-cols-4">
        <FormField label="키워드" required errors={fieldErrors(state, "keyword")}>
          {({ id, invalid, describedBy }) => (
            <>
              <Input
                id={id}
                name="keyword"
                list="place-rank-keywords"
                placeholder="예: 강남 치과"
                invalid={invalid}
                aria-describedby={describedBy}
                required
              />
              <datalist id="place-rank-keywords">
                {keywords.map((keyword) => (
                  <option key={keyword} value={keyword} />
                ))}
              </datalist>
            </>
          )}
        </FormField>

        <FormField label="날짜" required errors={fieldErrors(state, "recordedOn")}>
          {({ id, invalid, describedBy }) => (
            <DateInput
              id={id}
              name="recordedOn"
              defaultValue={today}
              invalid={invalid}
              aria-describedby={describedBy}
              required
            />
          )}
        </FormField>

        <FormField label="순위 (위)" required errors={fieldErrors(state, "rank")}>
          {({ id, invalid, describedBy }) => (
            <NumberInput
              id={id}
              name="rank"
              min={1}
              max={999}
              step={1}
              placeholder="예: 3"
              invalid={invalid}
              aria-describedby={describedBy}
              required
            />
          )}
        </FormField>

        <FormField label="메모" errors={fieldErrors(state, "memo")}>
          {({ id, invalid, describedBy }) => (
            <Input id={id} name="memo" placeholder="선택 입력" invalid={invalid} aria-describedby={describedBy} />
          )}
        </FormField>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중…" : "순위 기록"}
        </Button>
        <p className="text-xs text-slate-400">같은 키워드·날짜에 다시 기록하면 이전 값을 덮어씁니다.</p>
      </div>
    </form>
  );
}
