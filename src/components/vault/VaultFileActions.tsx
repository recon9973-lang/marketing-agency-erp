"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteVaultFileAction, moveVaultFileAction } from "@/server/actions/vault";

/** 파일별 이동/삭제 조작 — 누구나 사용 가능. */
export function VaultFileActions({
  fileId,
  folderId,
  fileName,
  folders
}: {
  fileId: string;
  folderId: string | null;
  fileName: string;
  folders: Array<{ id: string; name: string }>;
}) {
  const [moveState, moveAction] = useActionState(moveVaultFileAction, null);
  const [deleteState, deleteAction, deleting] = useActionState(deleteVaultFileAction, null);
  const router = useRouter();

  useEffect(() => {
    if (moveState?.ok || deleteState?.ok) {
      router.refresh();
    }
  }, [moveState, deleteState, router]);

  return (
    <div className="flex items-center gap-2">
      <form action={moveAction}>
        <input type="hidden" name="fileId" value={fileId} />
        <select
          name="folderId"
          defaultValue={folderId ?? ""}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="h-8 rounded-md border border-line bg-white px-2 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand/30"
          title="폴더 이동"
        >
          <option value="">미분류</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      </form>

      <form
        action={deleteAction}
        onSubmit={(event) => {
          if (!window.confirm(`'${fileName}' 파일을 삭제할까요?`)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="fileId" value={fileId} />
        <button
          type="submit"
          disabled={deleting}
          className="text-xs font-medium text-slate-400 transition hover:text-danger disabled:opacity-50"
        >
          {deleting ? "삭제 중…" : "삭제"}
        </button>
      </form>
    </div>
  );
}
