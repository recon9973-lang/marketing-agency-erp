"use client";

// 내부 채팅 — 방 목록 + 메시지 + 작성. 폴링(4초)으로 새 메시지 갱신.
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Plus, Users, Send, ArrowLeft } from "lucide-react";
import { startDirect, createChannel, sendChatMessage, getRoomMessages } from "@/server/actions/chat";
import type { ChatRoomRow, ChatMessageRow, StaffLite } from "@/server/repositories/chat";

const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "최고관리자", ADMIN: "관리자", MARKETER: "담당자" };
const timeFmt = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" });

export function ChatClient({ rooms, staff, meId }: { rooms: ChatRoomRow[]; staff: StaffLite[]; meId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(rooms[0]?.id ?? null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"none" | "direct" | "channel">("none");
  const [chName, setChName] = useState("");
  const [chMembers, setChMembers] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activeRoom = rooms.find((r) => r.id === activeId) ?? null;

  // 선택 방의 메시지 폴링(4초).
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let alive = true;
    const load = async () => {
      const res = await getRoomMessages({ roomId: activeId });
      if (alive && res.ok && res.data) setMessages(res.data);
    };
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function send() {
    if (!activeId || !body.trim()) return;
    const text = body;
    setBody("");
    start(async () => {
      const res = await sendChatMessage({ roomId: activeId, body: text });
      if (res.ok) {
        const m = await getRoomMessages({ roomId: activeId });
        if (m.ok && m.data) setMessages(m.data);
        router.refresh();
      }
    });
  }

  function openDirect(otherId: string) {
    start(async () => {
      const res = await startDirect({ otherUserId: otherId });
      if (res.ok && res.data) {
        setMode("none");
        setActiveId(res.data.roomId);
        router.refresh();
      }
    });
  }

  function makeChannel() {
    if (!chName.trim()) return;
    start(async () => {
      const res = await createChannel({ name: chName, memberIds: chMembers });
      if (res.ok && res.data) {
        setMode("none");
        setChName("");
        setChMembers([]);
        setActiveId(res.data.roomId);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex h-[calc(100vh-190px)] min-h-[420px] overflow-hidden rounded-2xl border border-line bg-card">
      {/* 방 목록 */}
      <aside className={`w-full shrink-0 flex-col border-r border-line sm:flex sm:w-64 ${activeId ? "hidden sm:flex" : "flex"}`}>
        <div className="flex items-center justify-between gap-1 border-b border-line p-3">
          <p className="text-sm font-bold text-ink">채팅</p>
          <div className="flex gap-1">
            <button type="button" onClick={() => setMode(mode === "direct" ? "none" : "direct")} className="rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-brand hover:text-brand">
              <Plus className="inline h-3 w-3" /> 1:1
            </button>
            <button type="button" onClick={() => setMode(mode === "channel" ? "none" : "channel")} className="rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-brand hover:text-brand">
              <Users className="inline h-3 w-3" /> 채널
            </button>
          </div>
        </div>

        {mode === "direct" && (
          <div className="max-h-48 overflow-y-auto border-b border-line p-2">
            <p className="px-1 pb-1 text-[10px] font-semibold uppercase text-slate-400">1:1 상대 선택</p>
            {staff.map((s) => (
              <button key={s.id} type="button" onClick={() => openDirect(s.id)} disabled={pending} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface">
                <span className="font-medium text-ink">{s.name}</span>
                <span className="text-[10px] text-slate-400">{ROLE_LABEL[s.role] ?? s.role}</span>
              </button>
            ))}
          </div>
        )}
        {mode === "channel" && (
          <div className="border-b border-line p-2">
            <input value={chName} onChange={(e) => setChName(e.target.value)} placeholder="채널 이름" className="mb-1.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-brand" />
            <div className="max-h-32 overflow-y-auto">
              {staff.map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 rounded px-1 py-1 text-xs hover:bg-surface">
                  <input type="checkbox" checked={chMembers.includes(s.id)} onChange={(e) => setChMembers((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)))} className="h-3.5 w-3.5 accent-brand" />
                  {s.name}
                </label>
              ))}
            </div>
            <button type="button" onClick={makeChannel} disabled={pending || !chName.trim()} className="mt-1.5 w-full rounded-md bg-brand px-2 py-1.5 text-xs font-bold text-white disabled:opacity-50">
              채널 만들기
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {rooms.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-400">대화가 없습니다. 1:1 또는 채널을 시작하세요.</p>
          ) : (
            rooms.map((r) => (
              <button key={r.id} type="button" onClick={() => setActiveId(r.id)} className={`flex w-full items-center gap-2 border-b border-line/60 px-3 py-2.5 text-left ${r.id === activeId ? "bg-brand-soft" : "hover:bg-surface"}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${r.type === "GROUP" ? "bg-sky-100 text-sky-600" : "bg-surface text-slate-500"}`}>
                  {r.type === "GROUP" ? <Users className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{r.title}</span>
                  <span className="block text-[10px] text-slate-400">{r.type === "GROUP" ? "채널" : "1:1"}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* 메시지 */}
      <div className={`flex-col ${activeId ? "flex" : "hidden sm:flex"} min-w-0 flex-1`}>
        {activeRoom ? (
          <>
            <div className="flex items-center gap-2 border-b border-line p-3">
              <button type="button" onClick={() => setActiveId(null)} className="sm:hidden" aria-label="뒤로">
                <ArrowLeft className="h-4 w-4 text-slate-500" />
              </button>
              <p className="text-sm font-bold text-ink">{activeRoom.title}</p>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {messages.length === 0 ? (
                <p className="pt-8 text-center text-xs text-slate-400">첫 메시지를 보내보세요.</p>
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === meId;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                        {!mine && <span className="mb-0.5 text-[10px] text-slate-400">{m.senderName}</span>}
                        <span className={`inline-block rounded-2xl px-3 py-1.5 text-sm ${mine ? "bg-brand text-white" : "bg-surface text-ink"}`}>{m.body}</span>
                        <span className="mt-0.5 text-[9px] text-slate-300">{timeFmt.format(new Date(m.createdAt))}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
            <div className="flex items-center gap-2 border-t border-line p-3">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="메시지 입력 (Enter 전송)"
                className="h-10 flex-1 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand"
              />
              <button type="button" onClick={send} disabled={pending || !body.trim()} className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-white disabled:opacity-50">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">대화를 선택하세요.</div>
        )}
      </div>
    </div>
  );
}
