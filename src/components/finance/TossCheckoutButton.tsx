"use client";

import { useEffect, useState } from "react";

const SDK_SRC = "https://js.tosspayments.com/v1/payment";

declare global {
  interface Window {
    // 토스 결제 SDK 전역. 로드 전에는 undefined.
    TossPayments?: (clientKey: string) => {
      requestPayment: (method: string, options: Record<string, unknown>) => Promise<void> | void;
    };
  }
}

/**
 * 토스 결제창을 여는 버튼. TOSS_CLIENT_KEY가 있을 때만 렌더된다.
 * 성공/실패 시 /pay/[id]/complete 로 리다이렉트되어 서버가 승인·기록한다.
 */
export function TossCheckoutButton({
  clientKey,
  billingId,
  amount,
  orderName
}: {
  clientKey: string;
  billingId: string;
  amount: number;
  orderName: string;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.TossPayments) {
      setReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    const script = existing ?? document.createElement("script");
    const onLoad = () => setReady(true);
    const onError = () => setError("결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    if (!existing) {
      script.src = SDK_SRC;
      script.async = true;
      document.body.appendChild(script);
    } else if (window.TossPayments) {
      setReady(true);
    }
    return () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
  }, []);

  const pay = () => {
    setError(null);
    const factory = window.TossPayments;
    if (!factory) {
      setError("결제 모듈이 아직 준비되지 않았습니다.");
      return;
    }
    try {
      const origin = window.location.origin;
      const orderId = `venom_${billingId}_${Date.now()}`;
      const back = `${origin}/pay/${billingId}/complete`;
      void factory(clientKey).requestPayment("카드", {
        amount,
        orderId,
        orderName,
        successUrl: back,
        failUrl: back
      });
    } catch {
      setError("결제창을 여는 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={pay}
        disabled={!ready}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {ready ? "카드로 결제하기 (토스)" : "결제 모듈 불러오는 중…"}
      </button>
      {error ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
