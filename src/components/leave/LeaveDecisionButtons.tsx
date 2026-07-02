"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { transitionLeave, type LeaveAction } from "@/domain/leave";
import type { LeaveStatus } from "@/domain/types";
import { decideLeaveRequestAction } from "@/server/actions/leave";

const LABELS: Record<LeaveAction, string> = {
  approve: "승인",
  reject: "반려",
  cancel: "취소"
};

const VARIANTS: Record<LeaveAction, "primary" | "secondary" | "danger"> = {
  approve: "primary",
  reject: "danger",
  cancel: "secondary"
};

export function LeaveDecisionButtons({
  id,
  status,
  actions
}: {
  id: string;
  status: LeaveStatus;
  actions: LeaveAction[];
}) {
  const [state, formAction, pending] = useActionState(decideLeaveRequestAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state, router]);

  const available = actions.filter((action) => transitionLeave(status, action) !== status);
  const error = state && !state.ok ? state.error.message : null;

  if (available.length === 0) {
    return <span className="text-xs text-slate-400">-</span>;
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {available.map((action) => (
          <form key={action} action={formAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value={action} />
            <Button type="submit" size="sm" variant={VARIANTS[action]} disabled={pending}>
              {LABELS[action]}
            </Button>
          </form>
        ))}
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
