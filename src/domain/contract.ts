// 광고 업무 대행 계약서 — 구조화 데이터 + 렌더 헬퍼(항목별 입력 → 계약서 서식).
// body(자유 텍스트) 대신 details(구조화 필드)로 저장하고, ContractDocument가 서식으로 렌더한다.

// 성과 미보장 고지(기획서 §9) — 클라이언트에서도 렌더하므로 도메인(순수)에 둔다.
// (서버 compliance/medical-law.ts와 동일 문구 — 그쪽은 서버 로직 전용이라 여기 복제)
export const NON_GUARANTEE_DISCLAIMER =
  "[성과 미보장 고지] 검색 상위노출, AI 답변 노출, 문의·매출 증가는 검색엔진 및 AI 서비스의 정책·알고리즘에 따라 변동되며, " +
  "본 계약은 특정 순위·노출·성과를 보장하지 않습니다. 모든 지표는 모니터링·개선 활동의 참고 자료로 제공됩니다.";

export const VENOM = {
  name: "주식회사 베놈",
  address: "대구광역시 수성구 용학로25길54, 5층",
  bizNo: "291-86-02777",
  ceo: "김보형",
  tel: "1661-4142"
} as const;

// 대행 범위 선택지(제2조). 라벨 = 표시·저장 값.
export const SCOPE_ONLINE = [
  "블로그(브랜드/배포/상위노출/인플루언서)",
  "SNS",
  "플레이스(SEO/리뷰)",
  "파워링크",
  "지식iN",
  "뉴스",
  "카페",
  "홈페이지"
] as const;

export const SCOPE_OFFLINE = [
  "전광판",
  "버스/택시",
  "지하철",
  "마트",
  "전단지",
  "현수막",
  "X배너",
  "사진촬영"
] as const;

export const PAY_TERMS_PRESETS = [
  "첫 진행 전 선결제를 원칙으로 하고, 월간 단위로 정산·청구한다.",
  "매월 선결제, 익월 초 세금계산서 발행.",
  "계약금 50% 선입금 후 착수, 잔금은 익월 정산."
] as const;

export type ScopeGroup = "online" | "offline" | "etc";
export type ScopeItem = { label: string; group: ScopeGroup; qty: number };
export const SCOPE_GROUP_LABEL: Record<ScopeGroup, string> = { online: "온라인", offline: "오프라인", etc: "기타" };

// 계약서 구조화 필드(Contract.details JSON에 저장).
export type ContractDetails = {
  clientAddress?: string; // 갑 주소
  clientBizNo?: string; // 갑 사업자번호
  clientCeo?: string; // 갑 대표자
  scopeItems?: ScopeItem[]; // 선택된 대행 범위 항목 + 수량(기타 수기 포함)
  scopeOnline?: string[]; // (레거시) 선택된 온라인 범위
  scopeOffline?: string[]; // (레거시) 선택된 오프라인 범위
  vatIncluded?: boolean; // 광고비 VAT 포함 여부
  payTerms?: string; // 지불조건 문구
  autoRenew?: boolean; // 1년 자동갱신
  special?: string; // 특약사항(선택)
};

/** 레거시(scopeOnline/Offline)를 scopeItems로 정규화 — 렌더/출력은 이것만 쓴다. */
export function resolveScopeItems(d: ContractDetails): ScopeItem[] {
  if (d.scopeItems?.length) return d.scopeItems;
  const items: ScopeItem[] = [];
  for (const l of d.scopeOnline ?? []) items.push({ label: l, group: "online", qty: 1 });
  for (const l of d.scopeOffline ?? []) items.push({ label: l, group: "offline", qty: 1 });
  return items;
}

/** 알 수 없는 값 방어 파서 — 저장된 details를 안전하게 읽는다. */
export function parseContractDetails(value: unknown): ContractDetails {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  const strArr = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string") : undefined);
  const str = (x: unknown) => (typeof x === "string" ? x : undefined);
  const scopeItems = Array.isArray(v.scopeItems)
    ? v.scopeItems
        .map((it): ScopeItem | null => {
          if (!it || typeof it !== "object") return null;
          const o = it as Record<string, unknown>;
          const label = typeof o.label === "string" ? o.label.trim() : "";
          const group = o.group === "online" || o.group === "offline" || o.group === "etc" ? o.group : "etc";
          const qty = Number(o.qty);
          if (!label) return null;
          return { label, group, qty: Number.isFinite(qty) && qty >= 1 ? Math.floor(qty) : 1 };
        })
        .filter((x): x is ScopeItem => x !== null)
    : undefined;
  return {
    clientAddress: str(v.clientAddress),
    clientBizNo: str(v.clientBizNo),
    clientCeo: str(v.clientCeo),
    scopeItems,
    scopeOnline: strArr(v.scopeOnline),
    scopeOffline: strArr(v.scopeOffline),
    vatIncluded: typeof v.vatIncluded === "boolean" ? v.vatIncluded : undefined,
    payTerms: str(v.payTerms),
    autoRenew: typeof v.autoRenew === "boolean" ? v.autoRenew : undefined,
    special: str(v.special)
  };
}

export function formatKoreanDate(d: Date | string | null | undefined): string {
  if (!d) return "____년 __월 __일";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "____년 __월 __일";
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function formatWon(amount: number | null | undefined): string {
  if (amount == null) return "____________";
  return `${Math.round(amount).toLocaleString("ko-KR")}`;
}

/** 구조화 details → 저장·검색용 평문 본문. ContractDocument와 내용 일치. */
export function contractBodyText(args: {
  clientName: string;
  amount: number | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  details: ContractDetails;
}): string {
  const d = args.details;
  const items = resolveScopeItems(d);
  const grp = (g: ScopeGroup) => items.filter((i) => i.group === g).map((i) => (i.qty > 1 ? `${i.label}×${i.qty}` : i.label)).join(", ");
  const scopeLine = (["online", "offline", "etc"] as ScopeGroup[])
    .map((g) => (grp(g) ? `${SCOPE_GROUP_LABEL[g]}: ${grp(g)}` : null))
    .filter(Boolean)
    .join(" / ") || "-";
  const vat = d.vatIncluded !== false ? "포함" : "별도";
  const pay = d.payTerms?.trim() || "첫 진행 전 선결제, 월간 정산·청구.";
  return [
    `광고 업무 대행 계약서`,
    `광고주 ${args.clientName} (갑) / ${VENOM.name} (을)`,
    ``,
    `제1조 목적: 광고 업무 대행 위임.`,
    `제2조 대행범위 — ${scopeLine}`,
    `제3조 광고비: 매월 ${formatWon(args.amount)}원 (VAT ${vat})`,
    `제4조 지불조건: ${pay}`,
    `제5조 계약기간: ${formatKoreanDate(args.startDate)} ~ ${formatKoreanDate(args.endDate)}${d.autoRenew === false ? " (만료 종료)" : " (1년 자동갱신)"}`,
    d.special?.trim() ? `제6조 특약: ${d.special.trim()}` : ``,
    ``,
    `[갑] ${args.clientName} / 주소 ${d.clientAddress ?? "-"} / 사업자 ${d.clientBizNo ?? "-"} / 대표 ${d.clientCeo ?? "-"}`,
    `[을] ${VENOM.name} / 주소 ${VENOM.address} / 사업자 ${VENOM.bizNo} / 대표 ${VENOM.ceo}`,
    NON_GUARANTEE_DISCLAIMER
  ].filter((l) => l !== undefined).join("\n");
}
