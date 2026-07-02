"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/server/action-result";

type CancelLeave = (leaveRequestId: string) => Promise<ActionResult<{ id: string; status: string }>>;

export function LeaveCancelButton({
  leaveRequestId,
  cancelLeave
}: {
  leaveRequestId: string;
  cancelLeave: CancelLeave;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handle = () => {
    startTransition(async () => {
      setErrorMessage(null);
      const result = await cancelLeave(leaveRequestId);

      if (result.ok) {
        router.refresh();
      } else {
        setErrorMessage(result.error.message);
      }
    });
  };

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={handle}
        className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-60"
      >
        취소
      </button>
      {errorMessage ? <p className="mt-1 text-xs text-danger">{errorMessage}</p> : null}
    </div>
  );
}
