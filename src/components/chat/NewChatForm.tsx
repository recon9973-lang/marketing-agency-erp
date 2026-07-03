"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { startDirectChatAction } from "@/server/actions/chat";

export function NewChatForm({ partners }: { partners: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState(startDirectChatAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.push(`/messages/${state.data.roomId}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-white p-4">
      <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs font-medium text-slate-500 md:max-w-72">
        <span>대화 상대</span>
        <Select name="userId" defaultValue="">
          <option value="" disabled>
            직원 선택
          </option>
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.name}
            </option>
          ))}
        </Select>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "여는 중…" : "대화 시작"}
      </Button>
      {state && !state.ok ? <p className="w-full text-xs text-danger">{state.error.message}</p> : null}
    </form>
  );
}
