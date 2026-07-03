import { redirect } from "next/navigation";
import { StudioFrame } from "@/components/studio/StudioFrame";
import { PageHeader } from "@/components/ui/PageHeader";
import { listStudioClients, listStudioStaff } from "@/server/repositories/studio";
import { getCurrentUser } from "@/server/session";

export default async function StudioPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [clients, staff] = await Promise.all([listStudioClients(user), listStudioStaff()]);

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="제작"
        title="이미지 스튜디오"
        description="카드뉴스·공지 팝업 이미지를 만들어 공용 보관함에 저장합니다."
      />
      <StudioFrame clients={clients} staff={staff} />
    </section>
  );
}
