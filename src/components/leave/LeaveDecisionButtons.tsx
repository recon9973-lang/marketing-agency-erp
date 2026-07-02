"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/server/action-result";

type DecideLeave = (
  leaveRequestId: string,
  input: { action: "approve" | "reject" }
) => Promise<ActionResult<{ id: string; status: string }>>;

export function LeaveDecisionButtons({
  leaveRequestId,
  decideLeave
}: {
  leaveRequestId: string;
  decideLeave: DecideLeave;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handle = (action: "approve" | "reject") => {
    startTransition(async () => {
      setErrorMessage(null);
      const result = await decideLeave(leaveRequestId, { action });

      if (result.ok) {
        router.refresh();
      } else {
        setErrorMessage(result.error.message);
      }
    });
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => handle("approve")}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          승인
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => handle("reject")}
          className="rounded-md border border-danger/40 px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
        >
          반려
        </button>
      </div>
      {errorMessage ? <p className="mt-1 text-xs text-danger">{errorMessage}</p> : null}
    </div>
  );
}
