"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toggleClientFavoriteAction } from "@/server/actions/favorites";

export function ClientFavoriteButton({ clientId, favored }: { clientId: string; favored: boolean }) {
  const [state, formAction, pending] = useActionState(toggleClientFavoriteAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="clientId" value={clientId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={favored ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        title={favored ? "즐겨찾기 해제" : "즐겨찾기 추가"}
        className={`text-lg leading-none transition disabled:opacity-50 ${
          favored ? "text-[#f0910f]" : "text-slate-300 hover:text-[#f0910f]"
        }`}
      >
        {favored ? "★" : "☆"}
      </button>
    </form>
  );
}
