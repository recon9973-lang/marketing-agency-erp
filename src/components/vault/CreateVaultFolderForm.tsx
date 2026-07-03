"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createVaultFolderAction } from "@/server/actions/vault";

/** 폴더 생성 폼 — 최고관리자에게만 노출한다. */
export function CreateVaultFolderForm() {
  const [state, formAction, pending] = useActionState(createVaultFolderAction, null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
        <span>새 폴더 이름</span>
        <Input name="name" placeholder="예: 서울치과 · 8월 소재" required maxLength={50} />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "만드는 중…" : "폴더 만들기"}
      </Button>
      {state && !state.ok ? <p className="w-full text-xs text-danger">{state.error.message}</p> : null}
    </form>
  );
}
