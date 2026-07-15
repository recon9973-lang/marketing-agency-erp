// 목표 경로: src/app/(erp)/insta/page.tsx
//
// 인스타 관리 — 발행 계정 관리 + 카드뉴스/이미지 발행 예약·즉시 발행·기록.
// 예약분은 크론(/api/marketing/cron {job:"insta-scheduled"})이 도래 시 자동 발행한다.
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { InstaManager } from "@/components/insta/InstaManager";
import { listInstagramAccounts, listInstagramPosts } from "@/server/repositories/instagram";
import { getDefaultOrgId } from "@/server/org";
import { getCurrentUser } from "@/server/session";

export default async function InstaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orgId = await getDefaultOrgId();
  const [accounts, posts] = await Promise.all([
    listInstagramAccounts(orgId).catch(() => []),
    listInstagramPosts(orgId).catch(() => [])
  ]);

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="SNS 운영"
        title="인스타 관리"
        description="인스타그램 발행 계정을 관리하고, 카드뉴스·이미지를 예약/즉시 발행합니다. 예약분은 크론이 도래 시 자동 발행합니다."
      />
      <InstaManager accounts={accounts} posts={posts} />
    </section>
  );
}
