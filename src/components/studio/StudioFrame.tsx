"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveStudioImageAction } from "@/server/actions/studio";

type StudioClient = { id: string; name: string; phone: string; addr: string };

/**
 * 이미지 스튜디오(public/studio.html) 임베드 브리지.
 * - iframe 준비되면 실제 거래처·직원 목록을 postMessage로 주입한다.
 * - 스튜디오의 'ERP 보관함에 저장' 요청을 받아 server action으로 보관함에 저장한다.
 */
export function StudioFrame({
  clients,
  staff
}: {
  clients: StudioClient[];
  staff: string[];
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const frame = iframeRef.current;
    const sendBootstrap = () => {
      frame?.contentWindow?.postMessage({ type: "studio:bootstrap", clients, staff }, window.location.origin);
    };

    function onMessage(event: MessageEvent) {
      if (!frame || event.source !== frame.contentWindow) return;
      const data = event.data as { type?: string; dataUrl?: string; fileName?: string };
      if (!data || typeof data.type !== "string") return;

      if (data.type === "studio:ready") {
        sendBootstrap();
        return;
      }

      if (data.type === "studio:save" && data.dataUrl) {
        void (async () => {
          const fd = new FormData();
          fd.set("dataUrl", data.dataUrl as string);
          if (data.fileName) fd.set("fileName", data.fileName);
          const result = await saveStudioImageAction(null, fd);
          frame.contentWindow?.postMessage(
            {
              type: "studio:saved",
              ok: result.ok,
              message: result.ok ? "" : result.error.message
            },
            window.location.origin
          );
          if (result.ok) {
            setNotice({ ok: true, text: "보관함에 저장되었습니다." });
            router.refresh();
          } else {
            setNotice({ ok: false, text: result.error.message });
          }
        })();
      }
    }

    window.addEventListener("message", onMessage);
    // ready 핑을 놓친 경우(레이스)를 대비해 iframe load 시에도 부트스트랩을 보낸다.
    frame?.addEventListener("load", sendBootstrap);
    if (frame?.contentWindow && frame.contentDocument?.readyState === "complete") {
      sendBootstrap();
    }
    return () => {
      window.removeEventListener("message", onMessage);
      frame?.removeEventListener("load", sendBootstrap);
    };
  }, [clients, staff, router]);

  return (
    <div className="space-y-2">
      <p className="rounded-md border border-line bg-surface/60 px-3 py-2 text-sm text-slate-600">
        거래처를 고르면 템플릿의 <b>{"{업체명} {전화}"}</b>가 실제 정보로 채워집니다. 완성한 이미지는 오른쪽 아래{" "}
        <b>‘🗂 ERP 보관함에 저장’</b> 버튼으로 공용 보관함에 저장됩니다.
      </p>
      {notice ? (
        <p
          className={`rounded-md border px-3 py-2 text-sm ${
            notice.ok ? "border-brand/30 bg-brand/10 text-brand" : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {notice.text}
        </p>
      ) : null}
      <iframe
        ref={iframeRef}
        src="/studio.html"
        title="이미지 스튜디오"
        className="h-[calc(100vh-13rem)] min-h-[700px] w-full rounded-md border border-line bg-[#141416]"
      />
    </div>
  );
}
