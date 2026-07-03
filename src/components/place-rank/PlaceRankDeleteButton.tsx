"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deletePlaceRankAction } from "@/server/actions/place-rank";

export function PlaceRankDeleteButton({ placeRankId }: { placeRankId: string }) {
  const [state, formAction, pending] = useActionState(deletePlaceRankAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("이 순위 기록을 삭제할까요?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={placeRankId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-semibold text-slate-400 transition hover:text-danger disabled:opacity-60"
      >
        삭제
      </button>
      {state && !state.ok ? <p className="mt-1 text-xs text-danger">{state.error.message}</p> : null}
    </form>
  );
}
