// GEO 콘텐츠 진단은 GEO 진단의 '콘텐츠 진단' 탭으로 통합 — 진입점 일원화(전수조사 2차).
// 딥링크·북마크 보존을 위해 라우트는 리다이렉트 스텁으로 유지한다.
import { redirect } from "next/navigation";

export default function RedirectPage() {
  redirect("/geo?tab=content-diagnosis");
}
