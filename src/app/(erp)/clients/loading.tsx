// [테스트] 거래처 탭만 로딩 화면 제거 — 리전 개선 후 로더 없이 바로 뜨는지 비교용.
// null 반환 = 이 라우트는 전환 시 로딩 폴백을 띄우지 않는다(그룹 FunLoader 무시).
// 다른 탭(FunLoader)과 체감 비교 후 유지/삭제 결정. 삭제하면 다시 FunLoader가 적용됨.
export default function ClientsLoading() {
  return null;
}
