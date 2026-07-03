"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteVaultFolderAction } from "@/server/actions/vault";

/** 폴더 삭제 버튼 — 최고관리자 전용. 폴더 안 파일은 미분류로 이동한다. */
export function DeleteVaultFolderButton({ folderId, folderName }: { folderId: string; folderName: string }) {
  const [state, formAction, pending] = useActionState(deleteVaultFolderAction, null);
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
        if (!window.confirm(`'${folderName}' 폴더를 삭제할까요?\n(폴더 안 파일은 삭제되지 않고 '미분류'로 이동합니다.)`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="folderId" value={folderId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-slate-400 transition hover:text-danger disabled:opacity-50"
      >
        {pending ? "삭제 중…" : "폴더 삭제"}
      </button>
      {state && !state.ok ? <span className="ml-2 text-xs text-danger">{state.error.message}</span> : null}
    </form>
  );
}
