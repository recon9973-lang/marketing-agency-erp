import { notFound, redirect } from "next/navigation";
import { Role } from "@/domain/types";
import { getContractDetail } from "@/server/repositories/contracts";
import { listActiveProducts } from "@/server/repositories/products";
import { listSurveysForContract } from "@/server/repositories/surveys";
import { ContractDetailView } from "@/components/contracts/ContractDetailView";
import { ContractProducts } from "@/components/contracts/ContractProducts";
import { ContractSurveys } from "@/components/contracts/ContractSurveys";
import { kakaoAlimtalkConfigured } from "@/server/integrations/kakao";
import { getCurrentUser } from "@/server/session";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const contract = await getContractDetail(user, id);
  if (!contract) notFound();

  const canDelete = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN || contract.authorName === user.name;
  // 계약 상세를 볼 수 있는 사람은 이미 거래처 접근 권한이 있으므로 설문 관리 허용.
  const canManageSurvey = true;
  const [productOptions, surveys] = await Promise.all([listActiveProducts(), listSurveysForContract(id)]);

  return (
    <div className="space-y-6">
      <a href="/contracts" className="text-sm font-semibold text-brand-strong hover:underline print:hidden">← 계약서 목록</a>
      <ContractDetailView contract={contract} canDelete={canDelete} />
      <ContractProducts
        contractId={contract.id}
        products={contract.products}
        monthlyTotal={contract.productMonthlyTotal}
        adBudgetTotal={contract.productAdBudgetTotal}
        options={productOptions}
        locked={contract.status === "SIGNED"}
      />
      <ContractSurveys contractId={contract.id} surveys={surveys} canManage={canManageSurvey} kakaoConfigured={kakaoAlimtalkConfigured()} />
    </div>
  );
}
