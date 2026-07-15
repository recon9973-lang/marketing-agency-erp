// 광고 업무 대행 계약서 — 서식 렌더(항목 데이터 → 계약서 형태).
// 서버/클라 양쪽에서 쓸 수 있는 순수 컴포넌트. 인쇄·PDF·원격 서명 페이지에서 재사용.
import {
  VENOM, NON_GUARANTEE_DISCLAIMER, SCOPE_GROUP_LABEL, resolveScopeItems,
  formatKoreanDate, formatWon, type ContractDetails, type ScopeGroup
} from "@/domain/contract";

export type ContractDocVariant = "customer" | "venom";

export type ContractDocProps = {
  clientName: string;
  amount: number | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  details: ContractDetails;
  variant: ContractDocVariant;
  signerName?: string | null;
  signerTitle?: string | null;
  signatureData?: string | null; // 갑(고객) 서명 PNG data URL
  signedAt?: Date | string | null;
};

export function ContractDocument({
  clientName, amount, startDate, endDate, details, variant,
  signerName, signerTitle, signatureData, signedAt
}: ContractDocProps) {
  const vat = details.vatIncluded !== false; // 기본 VAT 포함
  const payTerms = details.payTerms?.trim() || "첫 진행 전 선결제를 원칙으로 하고, 월간 단위로 정산·청구한다.";
  const dateStr = formatKoreanDate(signedAt ?? new Date());

  // 선택된 항목만 그룹별로. (미선택 항목은 출력하지 않음)
  const items = resolveScopeItems(details);
  const groups = (["online", "offline", "etc"] as ScopeGroup[])
    .map((g) => ({ g, list: items.filter((i) => i.group === g) }))
    .filter((x) => x.list.length > 0);

  return (
    <article className="contract-doc mx-auto max-w-[820px] bg-white px-10 py-12 text-[13px] leading-[1.9] text-black" style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}>
      <h1 className="mb-8 text-center text-2xl font-black tracking-[0.3em]">광 고 업 무 대 행 계 약 서</h1>

      <p className="mb-6">
        광고주 <b>{clientName || "____________"}</b> (이하 &ldquo;갑&rdquo;)과 {VENOM.name}(이하 &ldquo;을&rdquo;)은 아래와 같이
        광고 업무 대행에 관하여 계약을 체결한다.
      </p>

      <Section n="1" title="계약의 목적">
        본 계약은 &ldquo;갑&rdquo;이 &ldquo;을&rdquo;에게 광고 업무 대행을 위임하여 상호 신뢰로써 업무를 진행함에 있다.
      </Section>

      <Section n="2" title="광고 품목 및 대행 범위">
        {groups.length === 0 ? (
          <p className="pl-1 text-black/40">—</p>
        ) : (
          <div className="mt-1 space-y-1">
            {groups.map(({ g, list }) => (
              <p key={g} className="pl-1">
                <b>{SCOPE_GROUP_LABEL[g]}</b>　:　{list.map((i) => (i.qty > 1 ? `${i.label} ×${i.qty}` : i.label)).join(",　")}
              </p>
            ))}
          </div>
        )}
      </Section>

      <Section n="3" title="광고비">
        광고비는 매월 <b>{formatWon(amount)}</b>원(VAT {vat ? "포함" : "별도"})으로 책정하며, 협의를 통해 변동될 수 있다.
      </Section>

      <Section n="4" title="지불조건">{payTerms}</Section>

      <Section n="5" title="계약기간">
        본 계약은 <b>{formatKoreanDate(startDate)}</b>부터 <b>{formatKoreanDate(endDate)}</b>까지로 하며,
        {details.autoRenew === false ? " 기간 만료로 종료된다." : " 특별한 사유가 없으면 1년마다 자동 갱신된다."}
      </Section>

      {details.special?.trim() ? (
        <Section n="6" title="특약사항"><span className="whitespace-pre-wrap">{details.special}</span></Section>
      ) : null}

      <p className="mt-6 rounded border border-black/15 bg-black/[0.03] px-3 py-2 text-[11px] leading-[1.7] text-black/70">
        {NON_GUARANTEE_DISCLAIMER}
      </p>

      <p className="mt-8 text-center tracking-widest">{dateStr}</p>

      {/* 서명란 — 갑(고객) / 을(베놈) */}
      <div className="mt-8 grid grid-cols-2 gap-6">
        <SignBlock
          role="갑 (광고주)"
          name={clientName}
          address={details.clientAddress}
          bizNo={details.clientBizNo}
          ceo={details.clientCeo}
          signatureData={signatureData}
          signerName={signerName}
          signerTitle={signerTitle}
        />
        <SignBlock role="을 (대행사)" name={VENOM.name} address={VENOM.address} bizNo={VENOM.bizNo} ceo={VENOM.ceo} seal />
      </div>

      <p className="mt-10 border-t border-black/10 pt-3 text-center text-[11px] text-black/50">
        ※ 본 계약서는 <b>{variant === "customer" ? "고객 보관용" : "베놈 보관용"}</b>입니다. (동일 내용 2부 작성, 갑·을 각 1부 보관)
      </p>
    </article>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="font-bold">제 {n} 조 【{title}】</p>
      <div className="pl-3">{children}</div>
    </div>
  );
}

function SignBlock({
  role, name, address, bizNo, ceo, seal, signatureData, signerName, signerTitle
}: {
  role: string; name?: string | null; address?: string | null; bizNo?: string | null; ceo?: string | null;
  seal?: boolean; signatureData?: string | null; signerName?: string | null; signerTitle?: string | null;
}) {
  const repName = ceo || signerName || "____________";
  return (
    <div className="rounded border border-black/15 p-3 text-[12px] leading-[1.9]">
      <p className="mb-1 font-bold">{role}</p>
      <p>회 사 명 : {name || "____________"}</p>
      <p>주　　소 : {address || "____________"}</p>
      <p>사업자번호 : {bizNo || "____________"}</p>
      <p>
        대　　표 : {repName}{" "}
        {/* 갑·을 모두 이름 옆 "(서명 또는 인)" 자리에 서명/도장을 겹쳐 표시. */}
        <span className="relative inline-block align-middle">
          {/* 서명·도장이 있으면 뒤 안내문구는 더 흐리게 — 겹침 비침으로 인한 가독성 저하 방지. */}
          <span className={seal || signatureData ? "text-black/15" : "text-black/45"}>(서명 또는 인)</span>
          {seal ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/seal-venom.png" alt="베놈 도장" style={{ width: "60px", height: "60px" }} className="pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain opacity-90" />
          ) : signatureData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signatureData} alt="서명" style={{ height: "72px", maxWidth: "210px", filter: "contrast(1.8) brightness(0.65)" }} className="pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain" />
          ) : null}
        </span>
      </p>
      {!seal && signerTitle ? <p className="mt-1 text-[11px] text-black/50">{signerTitle}</p> : null}
    </div>
  );
}
