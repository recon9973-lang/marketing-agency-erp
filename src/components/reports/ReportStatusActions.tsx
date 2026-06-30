"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StatusDisplayBadge } from "@/components/ui/StatusBadge";
import { nextReportStatus, type ReportAction } from "@/domain/report";
import { reportStatusDisplay } from "@/domain/status";
import type { ReportStatus } from "@/domain/types";
import { changeReportStatusAction } from "@/server/actions/report";

const ACTIONS: { action: ReportAction; label: string; variant: "primary" | "secondary" | "danger" }[] = [
  { action: "submit", label: "검토 요청", variant: "primary" },
  { action: "approve", label: "승인", variant: "primary" },
  { action: "deliver", label: "전달 완료", variant: "primary" },
  { action: "return", label: "반려", variant: "danger" }
];

export function ReportStatusActions({ reportId, status }: { reportId: string; status: ReportStatus }) {
  const [state, formAction, pending] = useActionState(changeReportStatusAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state, router]);

  const available = ACTIONS.filter((entry) => nextReportStatus(status, entry.action) !== status);
  const error = state && !state.ok ? state.error.message : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span>현재 상태</span>
        <StatusDisplayBadge display={reportStatusDisplay(status)} />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {available.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {available.map((entry) => (
            <form key={entry.action} action={formAction}>
              <input type="hidden" name="id" value={reportId} />
              <input type="hidden" name="action" value={entry.action} />
              <Button type="submit" variant={entry.variant} size="sm" disabled={pending}>
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
