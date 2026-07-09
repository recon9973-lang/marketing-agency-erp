import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ImageStudio } from "@/components/ai/ImageStudio";
import { isImageConfigured } from "@/server/ai/image";
import { listVaultFolders } from "@/server/repositories/vault";
import { getCurrentUser } from "@/server/session";

// OPENAI_API_KEY를 요청 시점에 읽어 활성 여부를 정확히 반영.
export const dynamic = "force-dynamic";
// 이미지 생성은 수십 초 걸릴 수 있어 넉넉히.
export const maxDuration = 60;

export const metadata = { title: "이미지 스튜디오" };

export default async function ImageStudioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const folders = await listVaultFolders();

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="AI 이미지"
        title="이미지 스튜디오"
        description="프롬프트만 넣으면 블로그·카드뉴스·썸네일용 이미지를 AI로 생성합니다. 스타일·비율을 고르고 만든 뒤, 다운로드하거나 보관함에 바로 저장하세요."
      />
      <ImageStudio
        imageConfigured={isImageConfigured()}
        folders={folders.map((f) => ({ id: f.id, name: f.name }))}
      />
    </div>
  );
}
