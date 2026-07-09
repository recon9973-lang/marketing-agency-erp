"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Trash2 } from "lucide-react";
import { deleteMeeting } from "@/server/actions/meetings";

export function DeleteMeetingButton({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function onClick() {
    if (!confirm("이 회의를 삭제할까요? 회의록도 함께 삭제됩니다.")) return;
    start(async () => {
      const res = await deleteMeeting({ id: meetingId });
      if (!res.ok) return alert(res.error);
      router.push("/meetings" as Route);
    });
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-md border border-danger/40 px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-red-50 disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" /> 삭제
    </button>
  );
}
