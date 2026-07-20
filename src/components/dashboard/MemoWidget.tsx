// 서버 위젯 — 개인 메모를 조회해 메모장에 넘긴다.
import { getUserMemo } from "@/server/repositories/user-memo";
import { MemoPad } from "@/components/dashboard/MemoPad";

export async function MemoWidget({ userId }: { userId: string }) {
  const content = await getUserMemo(userId).catch(() => "");
  return <MemoPad initial={content} />;
}
