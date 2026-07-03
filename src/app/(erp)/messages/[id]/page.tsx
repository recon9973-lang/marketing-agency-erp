import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChatMessageForm } from "@/components/chat/ChatMessageForm";
import { ChatPoller } from "@/components/chat/ChatPoller";
import { ChatScrollAnchor } from "@/components/chat/ChatScrollAnchor";
import { getRoomForUser, listMessages, markRoomRead } from "@/server/repositories/chat";
import { getCurrentUser } from "@/server/session";

const timeFormatter = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long" });

export default async function ChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const room = await getRoomForUser(id, user.id);

  if (!room) {
    notFound();
  }

  const messages = await listMessages(id);

  // 화면을 여는 것으로 읽음 처리한다(idempotent 타임스탬프 갱신).
  await markRoomRead(id, user.id);

  let lastDay = "";

  return (
    <section className="flex h-[calc(100vh-9.5rem)] flex-col overflow-hidden rounded-md border border-line bg-white">
      <ChatPoller intervalMs={7000} />

      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="font-semibold text-ink">{room.displayName}</p>
          <p className="text-xs text-slate-400">
            {room.members.map((member) => member.name).join(", ")}
          </p>
        </div>
        <Link href="/messages" className="text-sm font-medium text-brand hover:underline">
          ← 대화 목록
        </Link>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-surface/50 p-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">첫 메시지를 보내보세요.</p>
        ) : null}
        {messages.map((message) => {
          const day = message.createdAt.toDateString();
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = message.senderId === user.id;

          return (
            <div key={message.id}>
              {showDay ? (
                <p className="my-3 text-center text-xs text-slate-400">{dayFormatter.format(message.createdAt)}</p>
              ) : null}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] ${mine ? "text-right" : "text-left"}`}>
                  {!mine ? <p className="mb-0.5 text-xs font-medium text-slate-500">{message.senderName}</p> : null}
                  <div
                    className={`inline-block whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
                      mine ? "bg-brand text-white" : "border border-line bg-white text-ink"
                    }`}
                  >
                    {message.body}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">{timeFormatter.format(message.createdAt)}</p>
                </div>
              </div>
            </div>
          );
        })}
        <ChatScrollAnchor dependency={messages.length} />
      </div>

      <ChatMessageForm roomId={room.id} />
    </section>
  );
}
