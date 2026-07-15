// 원격 서명 페이지 — 인증 없이 signToken으로 진입. 고객이 계약서를 확인하고 서명한다.
import { getContractForSigning } from "@/server/repositories/contracts";
import { parseContractDetails } from "@/domain/contract";
import { ContractDocument } from "@/components/contracts/ContractDocument";
import { SignClient } from "./SignClient";

export const dynamic = "force-dynamic";

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await getContractForSigning(token);

  if (!c) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#eef0f3] px-6">
        <div className="rounded-2xl bg-white p-8 text-center shadow">
          <p className="text-lg font-bold text-ink">유효하지 않은 서명 링크</p>
          <p className="mt-2 text-sm text-slate-500">링크가 만료되었거나 잘못되었습니다. 담당자에게 다시 요청해 주세요.</p>
        </div>
      </main>
    );
  }

  const details = parseContractDetails(c.details);
  const signed = c.status === "SIGNED";

  return (
    <main className="min-h-screen bg-[#eef0f3] py-8">
      <div className="mx-auto max-w-[880px] px-4">
        <div className="mb-5 text-center">
          <div className="text-xl font-black tracking-tight">VENOM<span className="text-brand">•</span></div>
          <p className="mt-1 text-sm text-slate-500">
            {signed ? "서명이 완료된 계약서입니다." : "아래 계약서를 확인하고 하단에서 서명해 주세요."}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-xl">
          <ContractDocument
            clientName={c.clientName}
            amount={c.amount ? Number(c.amount) : null}
            startDate={c.startDate}
            endDate={c.endDate}
            details={details}
            variant="customer"
            signerName={c.signerName}
            signatureData={c.signatureData}
            signedAt={c.signedAt}
          />
        </div>

        {signed ? (
          <div className="mt-6 rounded-2xl bg-white p-8 text-center shadow">
            <div className="text-3xl">✅</div>
            <p className="mt-2 text-lg font-bold text-emerald-600">이미 서명이 완료된 계약서입니다</p>
          </div>
        ) : (
          <SignClient token={token} />
        )}
      </div>
    </main>
  );
}
