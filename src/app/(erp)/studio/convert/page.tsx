import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ImageConverter } from "@/components/studio/ImageConverter";
import { getCurrentUser } from "@/server/session";

export const metadata = { title: "이미지 변환" };

export default async function ImageConvertPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="이미지 최적화"
        title="이미지 변환"
        description="PNG·JPG·WEBP 변환, 압축, 리사이즈를 한 번에. 여러 장을 올려 일괄 변환하고 ZIP으로 받으세요. 모든 처리는 브라우저에서 이뤄집니다(업로드 없음)."
      />
      <ImageConverter />
    </div>
  );
}
