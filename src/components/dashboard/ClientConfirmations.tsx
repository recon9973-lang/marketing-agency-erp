import Link from "next/link";
import type { Route } from "next";
import { Clock3, MessageSquare } from "lucide-react";
import type { ClientConfirmations as Confirmations } from "@/server/repositories/dashboard-extras";

// 거래처 컨펌 관리 — 컨펌 대기(REVIEWED, 미컨펌) + 최근 거래처 응답(피드백/컨펌).
function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

const KIND_LABEL: Record<string, string> = { CONTENT_CONFIRM: "콘텐츠 컨펌", GENERAL: "일반 피드백" };

export function ClientConfirmations({ data }: { data: Confirmations }) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 컨펌 대기 */}
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="mb-1 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-bold text-ink"><Clock3 className="h-4 w-4 text-amber-500" /> 거래처 컨펌 대기</p>
          <Link href={"/approvals" as Route} className="text-xs font-bold text-brand-strong">승인함 →</Link>
        </div>
        {data.pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-8 text-center text-sm text-slate-400">대기 중인 컨펌이 없습니다.</p>
        ) : (
          <ul>
            {data.pending.map((p) => (
              <li key={p.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-sm">🏥</span>
                <div className="min-w-0">
                  <b className="block truncate text-[13px] text-ink">{p.topic}</b>
                  <small className="text-[11.5px] text-slate-500">{p.clientName} · {p.month}</small>
                </div>
                <span className="ml-auto shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-600">대기</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 최근 거래처 응답 */}
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="mb-1 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-bold text-ink"><MessageSquare className="h-4 w-4 text-blue-500" /> 최근 거래처 응답</p>
        </div>
        {data.recent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-8 text-center text-sm text-slate-400">최근 응답이 없습니다.</p>
        ) : (
          <ul>
            {data.recent.map((r) => (
              <li key={r.id} className="flex items-start gap-3 border-b border-line py-2.5 last:border-0">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${r.kind === "CONTENT_CONFIRM" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
                  {KIND_LABEL[r.kind] ?? "응답"}
                </span>
                <div className="min-w-0 flex-1">
                  <b className="text-[12.5px] text-ink">{r.clientName}</b>
                  <p className="truncate text-[11.5px] text-slate-500">{r.message}</p>
                </div>
                <small className="shrink-0 text-[10.5px] text-slate-400">{relTime(r.createdAt)}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
