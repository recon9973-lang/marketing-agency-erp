"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { uploadVaultFileAction } from "@/server/actions/vault";

/** 파일 업로드 폼 — 누구나 사용 가능. 올릴 폴더를 고를 수 있다. */
export function VaultUploadForm({ folders }: { folders: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState(uploadVaultFileAction, null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setFileName(null);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
        <span>올릴 폴더</span>
        <Select name="folderId" defaultValue="">
          <option value="">미분류 (폴더 없음)</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </Select>
      </label>

      <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
        <span>파일 선택 (4MB 이하)</span>
        <div className="flex items-center gap-2">
          <label className="flex h-11 cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-3 text-sm text-slate-600 transition hover:bg-surface">
            📎 파일 찾기
            <input
              ref={fileRef}
              type="file"
              name="file"
              className="hidden"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
            />
          </label>
          <span className="truncate text-sm text-slate-500">{fileName ?? "선택된 파일 없음"}</span>
        </div>
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "올리는 중…" : "올리기"}
      </Button>
      {state && !state.ok ? <p className="w-full text-xs text-danger">{state.error.message}</p> : null}
    </form>
  );
}
