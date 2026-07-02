"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { ActionResult } from "@/server/action-result";

export type WorkStatusActionOption = {
  action: string;
  label: string;
};

export function WorkStatusButtons({
  workItemId,
  options,
  changeStatus
}: {
  workItemId: string;
  options: WorkStatusActionOption[];
  changeStatus: (workItemId: string, action: string) => Promise<ActionResult<{ id: string; status: string }>>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (options.length === 0) {
    return null;
  }

  const handle = (action: string) => {
    startTransition(async () => {
      setErrorMessage(null);
      const result = await changeStatus(workItemId, action);

      if (result.ok) {
        router.refresh();
      } else {
        setErrorMessage(result.error.message);
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {options.map((option) => (
          <Button
            key={option.action}
            variant="secondary"
            disabled={pending}
            onClick={() => handle(option.action)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
    </div>
  );
}
