// 서버 위젯 — 내부 공지사항을 조회해 클라이언트 위젯에 넘긴다(대시보드 Suspense 안에서 사용).
import { listInternalNotices } from "@/server/repositories/internal-notice";
import { InternalNotices } from "@/components/dashboard/InternalNotices";

export async function InternalNoticesWidget({ canManage }: { canManage: boolean }) {
  const notices = await listInternalNotices(8).catch(() => []);
  return <InternalNotices notices={notices} canManage={canManage} />;
}
