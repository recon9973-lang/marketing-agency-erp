"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { sendChatMessageAction } from "@/server/actions/chat";

export function ChatMessageForm({ roomId }: { roomId: string }) {
  const [state, formAction, pending] = useActionState(sendChatMessageAction, null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      inputRef.current?.focus();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="flex items-center gap-2 border-t border-line bg-white p-3">
      <input type="hidden" name="roomId" value={roomId} />
      <input
        ref={inputRef}
        name="body"
        placeholder="메시지 입력…"
        autoComplete="off"
        maxLength={2000}
        className="h-11 flex-1 rounded-md border border-line bg-white px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      <Button type="submit" disabled={pending}>
        전송
      </Button>
      {state && !state.ok ? <p className="text-xs text-danger">{state.error.message}</p> : null}
    </form>
  );
}
