"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createGroupRoomAction } from "@/server/actions/chat";

export function NewGroupRoomForm({
  partners,
  clients
}: {
  partners: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createGroupRoomAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.push(`/messages/${state.data.roomId}`);
    }
  }, [state, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-dashed border-line bg-white px-4 py-3 text-sm font-medium text-slate-500 transition hover:border-brand hover:text-brand"
      >
        + 업무 협업방 만들기 (여러 명 + 거래처 연결)
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink">업무 협업방 만들기</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-ink">
          접기
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          <span>협업방 이름 *</span>
          <Input name="name" placeholder="예: 서울덴탈 7월 캠페인" required maxLength={60} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          <span>거래처 연결 (선택)</span>
          <Select name="clientId" defaultValue="">
            <option value="">연결 안 함</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <fieldset className="rounded-md border border-line p-3">
        <legend className="px-1 text-xs font-medium text-slate-500">멤버 선택 *</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {partners.map((partner) => (
            <label key={partner.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="memberIds" value={partner.id} className="h-4 w-4 accent-[#1f7a68]" />
              {partner.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "만드는 중…" : "협업방 만들기"}
        </Button>
        {state && !state.ok ? <p className="text-xs text-danger">{state.error.message}</p> : null}
      </div>
    </form>
  );
}
