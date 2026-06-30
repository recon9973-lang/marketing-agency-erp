"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StatusDisplayBadge } from "@/components/ui/StatusBadge";
import { nextWorkStatus, type WorkStatusAction } from "@/domain/work";
import { workStatusDisplay } from "@/domain/status";
import type { WorkStatus } from "@/domain/types";
import { changeWorkStatusAction } from "@/server/actions/work";

const ACTIONS: { action: WorkStatusAction; label: string }[] = [
  { action: "start", label: "진행 시작" },
  { action: "submit_for_review", label: "검수 요청" },
  { action: "approve", label: "완료 승인" },
  { action: "block", label: "차단" },
  { action: "resume", label: "재개" }
];

export function WorkStatusActions({ workItemId, status }: { workItemId: string; status: WorkStatus }) {
  const [state, formAction, pending] = useActionState(changeWorkStatusAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state, router]);

  const available = ACTIONS.filter((entry) => nextWorkStatus(status, entry.action) !== status);
  const error = state && !state.ok ? state.error.message : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span>현재 상태</span>
        <StatusDisplayBadge display={workStatusDisplay(status)} />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {available.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {available.map((entry) => (
            <form key={entry.action} action={formAction}>
              <input type="hidden" name="id" value={workItemId} />
              <input type="hidden" name="action" value={entry.action} />
              <Button type="submit" variant="secondary" size="sm" disabled={pending}>
                {entry.label}
              </Button>
            </form>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">현재 상태에서 가능한 전이가 없습니다.</p>
      )}
    </div>
  );
}
