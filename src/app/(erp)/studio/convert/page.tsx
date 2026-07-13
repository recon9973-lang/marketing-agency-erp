import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ImageConvertTool } from "@/components/studio/ImageConvertTool";
import { getCurrentUser } from "@/server/session";

export const metadata = { title: "이미지 변환 도구" };

export default async function ImageConvertPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="디자인 · 변환"
        title="이미지 변환 도구"
        description="여러 이미지를 WEBP·JPG·PNG로 일괄 변환하고 압축·리사이즈합니다. 브라우저에서 바로 처리되어 업로드 없이 빠르고, 변환 전후 용량을 비교해 ZIP으로 받습니다."
      />
      <ImageConvertTool />
    </div>
  );
}
