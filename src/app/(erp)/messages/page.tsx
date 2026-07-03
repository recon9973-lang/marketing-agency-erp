import Link from "next/link";
import { redirect } from "next/navigation";
import { ChatPoller } from "@/components/chat/ChatPoller";
import { NewChatForm } from "@/components/chat/NewChatForm";
import { NewGroupRoomForm } from "@/components/chat/NewGroupRoomForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { listChatPartners, listRoomsForUser } from "@/server/repositories/chat";
import { fetchClientsForUser } from "@/server/repositories/clients";
import { getCurrentUser } from "@/server/session";

const timeFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" });

export default async function MessagesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [rooms, partners, clients] = await Promise.all([
    listRoomsForUser(user.id),
    listChatPartners(user.id),
    fetchClientsForUser(user)
  ]);

  return (
    <section className="space-y-6">
      <ChatPoller intervalMs={10000} />
      <PageHeader
        eyebrow="메시지"
        title="내부 채팅"
        description="직원끼리 1:1 또는 협업방으로 대화합니다. 새 메시지는 자동으로 갱신됩니다."
      />

      <NewChatForm partners={partners} />
      <NewGroupRoomForm
        partners={partners}
        clients={clients.map((client) => ({ id: client.id, name: client.name }))}
      />

      {rooms.length === 0 ? (
        <EmptyState
          title="아직 대화가 없습니다"
          description="위에서 직원을 선택해 첫 대화를 시작해보세요."
        />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-md border border-line bg-white">
          {rooms.map((room) => (
            <Link
              key={room.id}
              href={`/messages/${room.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-surface"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{room.displayName}</p>
                <p className="mt-0.5 truncate text-sm text-slate-500">{room.lastMessageBody ?? "대화를 시작해보세요."}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {room.unreadCount > 0 ? (
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-2 text-xs font-semibold text-white">
                    {room.unreadCount}
                  </span>
                ) : null}
                <span className="text-xs text-slate-400">
                  {room.lastMessageAt ? timeFormatter.format(room.lastMessageAt) : ""}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
