"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { sendChatMessageAction } from "@/server/actions/chat";

export function ChatMessageForm({ roomId }: { roomId: string }) {
  const [state, formAction, pending] = useActionState(sendChatMessageAction, null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setFileName(null);
      inputRef.current?.focus();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="border-t border-line bg-white p-3">
      <input type="hidden" name="roomId" value={roomId} />

      {fileName ? (
        <div key="attachment-chip" className="mb-2 flex items-center gap-2 text-xs text-slate-600">
          <span className="rounded-md border border-line bg-surface px-2 py-1">📎 {fileName}</span>
          <button
            type="button"
            className="text-slate-400 hover:text-danger"
            onClick={() => {
              if (fileRef.current) {
                fileRef.current.value = "";
              }
              setFileName(null);
            }}
          >
            첨부 취소
          </button>
        </div>
      ) : null}

      <div key="controls" className="flex items-center gap-2">
        <label
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line bg-white text-lg text-slate-500 transition hover:bg-surface"
          title="파일 첨부 (4MB 이하)"
        >
          📎
          <input
            ref={fileRef}
            type="file"
            name="file"
            className="hidden"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
          />
        </label>
        <input
          ref={inputRef}
          name="body"
          placeholder="메시지 입력…"
          autoComplete="off"
          maxLength={2000}
          className="h-11 flex-1 rounded-md border border-line bg-white px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "전송 중…" : "전송"}
        </Button>
      </div>

      {state && !state.ok ? <p className="mt-1 text-xs text-danger">{state.error.message}</p> : null}
    </form>
  );
}
