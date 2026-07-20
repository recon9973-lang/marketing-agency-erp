// 서버 위젯 — 대시보드 최근 채팅. 최근 대화방을 요약해 보여주고 채팅으로 이동.
import Link from "next/link";
import { MessageSquare, ArrowUpRight, Users, User } from "lucide-react";
import { listChatRooms } from "@/server/repositories/chat";
import type { CurrentUser } from "@/server/session";

function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export async function ChatWidget({ user }: { user: CurrentUser }) {
  const rooms = await listChatRooms(user.id).catch(() => []);

  return (
    <section className="flex h-full flex-col rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-bold text-ink">채팅</h2>
        </div>
        <Link href="/chat" className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand hover:text-brand-strong">
          채팅 열기 <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {rooms.length === 0 ? (
        <Link href="/chat" className="mt-3 flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface/40 px-3 py-6 text-center text-xs text-slate-400 hover:border-brand/40 hover:text-brand">
          아직 대화가 없습니다. 채팅에서 1:1·팀 채널을 시작하세요.
        </Link>
      ) : (
        <div className="mt-3 space-y-1">
          {rooms.slice(0, 6).map((r) => (
            <Link key={r.id} href="/chat" className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface">
              {r.type === "GROUP" ? <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.title}</span>
              <span className="shrink-0 text-[11px] text-slate-400">{relTime(r.lastMessageAt)}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
