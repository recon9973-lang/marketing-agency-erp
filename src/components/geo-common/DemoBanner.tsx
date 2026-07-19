// GEO 정직성 배너 — 목업/데모 화면임을 명확히 고지하고, "어떻게 연결하면 실측되는지"까지 제안.
// 원칙: 실측만 노출, 미연결은 데모로 명시 + 연결 경로 안내. 실측 대안 링크도 제시.
import Link from "next/link";
import type { Route } from "next";

export function DemoBanner({
  title = "데모 데이터",
  message,
  connectKeys,
  realHref,
  realLabel
}: {
  title?: string;
  message: string;
  connectKeys?: string[]; // 이 기능을 실측으로 켜는 데 필요한 env 키
  realHref?: string;
  realLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-200/70 px-2 py-0.5 font-bold">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {title}
        </span>
        <span className="text-amber-800/90">{message}</span>
        {realHref && realLabel && (
          <Link href={realHref as Route} className="ml-auto font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950">
            {realLabel} →
          </Link>
        )}
      </div>
      {connectKeys && connectKeys.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-amber-200 pt-2">
          <span className="text-amber-700">실측 연결:</span>
          {connectKeys.map((k) => (
            <code key={k} className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] text-amber-900">{k}</code>
          ))}
          <Link href={"/integrations" as Route} className="ml-1 font-semibold text-amber-900 underline underline-offset-2">연결 상태 보기 →</Link>
        </div>
      )}
    </div>
  );
}
