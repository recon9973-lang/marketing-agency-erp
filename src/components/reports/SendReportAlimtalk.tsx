"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { sendReportAlimtalkAction } from "@/server/actions/report-alimtalk";

export function SendReportAlimtalk({
  reportId,
  configured,
  defaultPhone
}: {
  reportId: string;
  configured: boolean;
  defaultPhone: string | null;
}) {
  const [state, formAction, pending] = useActionState(sendReportAlimtalkAction, null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">카카오 알림톡 보내기</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            configured ? "bg-brand/10 text-brand" : "bg-surface text-slate-500"
          }`}
        >
          {configured ? "알림톡 연동됨" : "미연동(미리보기)"}
        </span>
      </div>

      {!configured ? (
        <p className="text-xs text-slate-500">
          지금은 실제로 발송되지 않고 미리보기만 됩니다. 발신프로필·승인 템플릿과{" "}
          <code>KAKAO_ALIMTALK_API_KEY</code> 등 환경 변수를 넣으면 실제 발송으로 바뀝니다. (코드 변경 없음)
        </p>
      ) : null}

      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={reportId} />
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
          <span>받는 사람 번호 (비우면 거래처 등록 번호로 발송)</span>
          <Input name="to" type="tel" placeholder={defaultPhone ?? "예: 010-1234-5678"} />
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "처리 중…" : configured ? "알림톡 보내기" : "미리보기"}
        </Button>
      </form>

      {state && !state.ok ? <p className="text-xs text-danger">{state.error.message}</p> : null}

      {state?.ok ? (
        state.data.sent ? (
          <p className="rounded-md border border-brand/30 bg-brand/10 px-3 py-2 text-sm text-brand">
            ✅ <b>{state.data.to}</b> 로 알림톡을 보냈습니다.
          </p>
        ) : (
          <div className="space-y-2 rounded-md border border-line bg-surface/50 p-3">
            <p className="text-sm text-amber-700">
              미연동 상태라 실제로 발송하지 않았습니다. 받는 사람: <b>{state.data.to}</b>
            </p>
            <pre className="whitespace-pre-wrap rounded-md border border-line bg-white p-3 text-sm text-ink">
              {state.data.text}
            </pre>
          </div>
        )
      ) : null}
    </div>
  );
}
