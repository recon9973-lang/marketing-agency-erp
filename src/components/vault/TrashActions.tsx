"use client";

// 휴지통 파일 복원/영구삭제 — 관리자 이상.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { restoreVaultFile, purgeVaultFile } from "@/server/actions/vault";

export function TrashActions({ fileId }: { fileId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function restore() {
    start(async () => {
      await restoreVaultFile({ id: fileId });
      router.refresh();
    });
  }
  function purge() {
    if (!confirm("이 파일을 영구 삭제할까요? 되돌릴 수 없습니다.")) return;
    start(async () => {
      await purgeVaultFile({ id: fileId });
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-1.5">
      <button type="button" onClick={restore} disabled={pending} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold text-slate-600 hover:border-brand hover:text-brand disabled:opacity-50">
        <RotateCcw className="h-3 w-3" /> 복원
      </button>
      <button type="button" onClick={purge} disabled={pending} className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50 disabled:opacity-50">
        <Trash2 className="h-3 w-3" /> 영구삭제
      </button>
    </div>
  );
}
