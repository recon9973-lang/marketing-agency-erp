// 공용 · 데이터 연결 상태 배지 — ERP 전역(연결 상태 정책 doc §4).
// 기존 StatusBadge(tone) 재사용. 3상태: 연결됨(실측)/데모(미연결이나 데모 표시)/미연결.
import { StatusBadge } from "./StatusBadge";

export type ConnectionState = "connected" | "demo" | "unconnected";

const MAP: Record<ConnectionState, { tone: "success" | "warning" | "neutral"; label: string; dot: string }> = {
  connected: { tone: "success", label: "연결됨", dot: "bg-emerald-500" },
  demo: { tone: "warning", label: "데모(미연결)", dot: "bg-amber-500" },
  unconnected: { tone: "neutral", label: "미연결", dot: "bg-slate-400" }
};

/** state로 직접 표시. 라벨을 덮어쓰려면 label, 연결 안내를 붙이려면 hint. */
export function ConnectionBadge({ state, label, hint }: { state: ConnectionState; label?: string; hint?: string }) {
  const m = MAP[state];
  return (
    <StatusBadge tone={m.tone}>
      <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {label ?? m.label}
      {hint ? <span className="ml-1 font-normal opacity-70">· {hint}</span> : null}
    </StatusBadge>
  );
}

/** configured 불린 → 연결됨/미연결(간편). 데모 상태는 state로 직접 지정. */
export function ConnectionBadgeFor({ configured, hint }: { configured: boolean; hint?: string }) {
  return <ConnectionBadge state={configured ? "connected" : "unconnected"} hint={hint} />;
}
