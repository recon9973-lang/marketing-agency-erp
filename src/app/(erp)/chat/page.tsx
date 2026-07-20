// 내부 채팅 — 1:1·팀 채널. 폴링 기반(실시간 웹소켓 아님).
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChatClient } from "@/components/chat/ChatClient";
import { listChatRooms, listStaffForChat } from "@/server/repositories/chat";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "채팅" };

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [rooms, staff] = await Promise.all([listChatRooms(user.id), listStaffForChat(user.id)]);

  return (
    <section className="space-y-4">
      <PageHeader eyebrow="협업" title="채팅" description="직원 간 1:1 대화와 팀 채널. 몇 초 간격으로 새 메시지가 갱신됩니다." />
      <ChatClient rooms={rooms} staff={staff} meId={user.id} />
    </section>
  );
}
