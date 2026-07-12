// 목표 경로: src/components/clients/GoogleIntegrationPanel.tsx
//
// 거래처별 구글(GSC/GA4) 연결 패널 — 대상 리소스 설정 → OAuth 연결 → 즉시 동기화 → 해제(권한 회수).
// 수집된 지표는 거래처 인사이트·월간 리포트가 자동 소비한다(§13).
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveGoogleConnectionSettings,
  disconnectGoogleConnection,
  syncChannelMetricsNow
} from "@/server/actions/channel-connections";

export type GoogleConnectionView = {
  status: string; // DISCONNECTED | CONNECTED | ERROR
  gscSiteUrl: string | null;
  ga4PropertyId: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
} | null;

const inputCls =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink placeholder:text-slate-400";

export function GoogleIntegrationPanel({
  clientId,
  connection,
  googleConfigured
}: {
  clientId: string;
  connection: GoogleConnectionView;
  googleConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const status = connection?.status ?? "DISCONNECTED";
  const connected = status === "CONNECTED";

  function saveSettings(form: FormData) {
    setMsg(null);
    start(async () => {
      const res = await saveGoogleConnectionSettings({
        clientId,
        gscSiteUrl: String(form.get("gscSiteUrl") ?? "") || null,
        ga4PropertyId: String(form.get("ga4PropertyId") ?? "") || null
      });
      if (!res.ok) setMsg(res.error);
      else {
        setMsg("저장됨");
        router.refresh();
      }
    });
  }

  function syncNow() {
    setMsg(null);
    start(async () => {
      const res = await syncChannelMetricsNow();
      if (!res.ok) setMsg(res.error);
      else {
        setMsg(`동기화 완료 — 성공 ${res.data?.synced ?? 0}건 · 지표 ${res.data?.rows ?? 0}행${res.data?.failed ? ` · 실패 ${res.data.failed}건` : ""}`);
        router.refresh();
      }
    });
  }

  function disconnect() {
    if (!window.confirm("구글 연결을 해제(권한 회수)합니다. 저장된 토큰이 삭제되며 자동 수집이 중단됩니다.")) return;
    start(async () => {
      const res = await disconnectGoogleConnection({ clientId });
      if (!res.ok) setMsg(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink">구글 데이터 연결 (GSC · GA4)</p>
          <p className="mt-0.5 text-xs text-slate-500">검색 노출·클릭과 방문 세션을 매일 수집해 인사이트·월간 리포트에 반영합니다.</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
            connected
              ? "bg-emerald-50 text-emerald-700"
              : status === "ERROR"
                ? "bg-rose-50 text-rose-600"
                : "border border-line bg-surface text-slate-500"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : status === "ERROR" ? "bg-rose-500" : "bg-slate-400"}`} />
          {connected ? "연결됨" : status === "ERROR" ? "오류" : "미연결"}
        </span>
      </div>

      {!googleConfigured && (
        <p className="mt-3 rounded-lg bg-surface/60 p-2.5 text-xs text-slate-500">
          서버에 <code className="font-mono">GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI</code> 환경변수를
          설정하면 연결 버튼이 활성화됩니다. (연동 화면 참고)
        </p>
      )}

      <form action={saveSettings} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="text-xs font-medium text-slate-600">
          GSC 사이트
          <input
            name="gscSiteUrl"
            defaultValue={connection?.gscSiteUrl ?? ""}
            maxLength={300}
            className={`mt-1 ${inputCls}`}
            placeholder="sc-domain:myclinic.co.kr"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          GA4 속성 ID
          <input
            name="ga4PropertyId"
            defaultValue={connection?.ga4PropertyId ?? ""}
            maxLength={30}
            inputMode="numeric"
            className={`mt-1 ${inputCls}`}
            placeholder="123456789"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="self-end rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-surface disabled:opacity-50"
        >
          저장
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {googleConfigured && (
          <a
            href={`/api/integrations/google/start?clientId=${clientId}`}
            className="rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white"
          >
            {connected ? "구글 계정 다시 연결" : "구글 계정 연결"}
          </a>
        )}
        {connected && (
          <button type="button" onClick={syncNow} disabled={pending} className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-surface disabled:opacity-50">
            {pending ? "동기화 중…" : "지금 동기화"}
          </button>
        )}
        {(connected || status === "ERROR") && (
          <button type="button" onClick={disconnect} disabled={pending} className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
            연결 해제(권한 회수)
          </button>
        )}
        {connection?.lastSyncAt && (
          <span className="text-[11px] text-slate-400">마지막 동기화 {new Date(connection.lastSyncAt).toLocaleString("ko-KR")}</span>
        )}
      </div>
      {status === "ERROR" && connection?.lastError && (
        <p className="mt-2 text-xs text-rose-600">동기화 오류: {connection.lastError}</p>
      )}
      {msg && <p className="mt-2 text-xs text-slate-500">{msg}</p>}
    </div>
  );
}
