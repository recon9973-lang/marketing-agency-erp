import { redirect } from "next/navigation";

// 주간보고는 결재 카테고리 내부 탭으로 이동했습니다. 기존 링크·북마크 호환용 리다이렉트.
export default function WeeklyRedirectPage() {
  redirect("/reports?doc=weekly");
}
