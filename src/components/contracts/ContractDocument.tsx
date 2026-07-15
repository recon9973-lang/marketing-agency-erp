// 광고 업무 대행 계약서 — 서식 렌더(항목 데이터 → 계약서 형태).
// 서버/클라 양쪽에서 쓸 수 있는 순수 컴포넌트. 인쇄·PDF·원격 서명 페이지에서 재사용.
import {
  VENOM, SCOPE_ONLINE, SCOPE_OFFLINE, NON_GUARANTEE_DISCLAIMER,
  formatKoreanDate, formatWon, type ContractDetails
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

function ScopeLine({ label, selected }: { label: string; selected: string[] }) {
  const on = selected.includes(label);
  return (
    <span className="mr-3 inline-block whitespace-nowrap">
      <span className="font-bold">{on ? "☑" : "☐"}</span> {label}
    </span>
  );
}

export function ContractDocument({
  clientName, amount, startDate, endDate, details, variant,
  signerName, signerTitle, signatureData, signedAt
}: ContractDocProps) {
  const online = details.scopeOnline ?? [];
  const offline = details.scopeOffline ?? [];
  const vat = details.vatIncluded !== false; // 기본 VAT 포함
  const payTerms = details.payTerms?.trim() || "첫 진행 전 선결제를 원칙으로 하고, 월간 단위로 정산·청구한다.";
  const dateStr = formatKoreanDate(signedAt ?? new Date());

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
        <div className="mt-1">
          <p className="mb-1"><b>온라인</b></p>
          <p className="pl-3">{SCOPE_ONLINE.map((s) => <ScopeLine key={s} label={s} selected={online} />)}</p>
          <p className="mb-1 mt-2"><b>오프라인</b></p>
          <p className="pl-3">{SCOPE_OFFLINE.map((s) => <ScopeLine key={s} label={s} selected={offline} />)}</p>
        </div>
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
  return (
    <div className="rounded border border-black/15 p-3 text-[12px] leading-[1.9]">
      <p className="mb-1 font-bold">{role}</p>
      <p>회 사 명 : {name || "____________"}</p>
      <p>주　　소 : {address || "____________"}</p>
      <p>사업자번호 : {bizNo || "____________"}</p>
      <p className="relative">
        대　　표 : {ceo || (signerName || "____________")}
        {/* 을(베놈) 도장 자동 날인 */}
        {seal ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/seal-venom.png" alt="베놈 도장" className="absolute -top-3 right-6 h-16 w-16 object-contain opacity-90" />
        ) : null}
        {/* 갑(고객) 서명 이미지 */}
        {!seal && signatureData ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signatureData} alt="서명" className="absolute -top-4 right-2 h-14 object-contain" />
        ) : (
          <span className="text-black/40"> {seal ? "(인)" : "(인/서명)"}</span>
        )}
      </p>
      {!seal && signerTitle ? <p className="mt-1 text-[11px] text-black/50">{signerTitle}</p> : null}
    </div>
  );
}
