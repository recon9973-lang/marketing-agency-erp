import { redirect } from "next/navigation";

// 이미지 스튜디오는 스튜디오(디자인+이미지 병합)로 통합됨 — 딥링크 보존용 리다이렉트.
export default function ImageStudioRedirect() {
  redirect("/studio?tab=image");
}
