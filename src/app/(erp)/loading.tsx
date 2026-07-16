// ERP 공통 로딩 — 콜드/전환 대기를 브랜드 인터랙션으로 연출(FunLoader, 텍스트 안내 포함).
// (erp) 그룹의 모든 하위 페이지가 서버 데이터를 불러오는 동안 즉시 표시된다.
import { FunLoader } from "@/components/erp/FunLoader";

export default function ErpLoading() {
  return <FunLoader />;
}
