"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ExpenseReviewStatus } from "@/domain/types";
import { reviewExpenseAction } from "@/server/actions/finance";

const DECISIONS: { value: ExpenseReviewStatus; label: string; variant: "primary" | "secondary" | "danger" }[] = [
  { value: ExpenseReviewStatus.REVIEWED, label: "검토완료", variant: "primary" },
  { value: ExpenseReviewStatus.NEEDS_FOLLOW_UP, label: "확인필요", variant: "secondary" },
  { value: ExpenseReviewStatus.EXCLUDED, label: "제외", variant: "danger" }
];

export function ExpenseReviewButtons({ id, reviewStatus }: { id: string; reviewStatus: ExpenseReviewStatus }) {
  const [state, formAction, pending] = useActionState(reviewExpenseAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state, router]);

  const error = state && !state.ok ? state.error.message : null;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {DECISIONS.filter((decision) => decision.value !== reviewStatus).map((decision) => (
          <form key={decision.value} action={formAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="reviewStatus" value={decision.value} />
            <Button type="submit" size="sm" variant={decision.variant} disabled={pending}>
              {decision.label}
            </Button>
          </form>
        ))}
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
