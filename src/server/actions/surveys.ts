// 목표 경로: src/server/actions/surveys.ts
//
// 설문폼 — 계약 상품 기반 자동 생성 → (담당자 확인) → 발송 → 외부 응답 수신.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertCanAccessClient } from "@/domain/access-control";
import { parseContractDetails, resolveScopeItems } from "@/domain/contract";
import { db } from "@/server/db";
import { sendAlimtalk } from "@/server/integrations/kakao";
import { getDefaultOrgId } from "@/server/org";

// 배포 환경의 공개 베이스 URL(설문 링크 구성용).
function appBaseUrl(): string | null {
  const raw = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  return raw ? raw.replace(/\/$/, "") : null;
}
import {
  getAdminScopes,
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";

export type SurveyQuestion = { id: string; label: string; type: "text" | "textarea" | "choice"; options?: string[]; required?: boolean; default?: string; allowOther?: boolean };

// ── STEP 1. 마케팅 시작 설문 ── (시작 전 1회). 진료·고객 현황 + 방향성·강점 수집.
const START_QUESTIONS: SurveyQuestion[] = [
  { id: "hospital_name", label: "업체명(병원명)", type: "text", required: true },
  { id: "rep_name", label: "대표 / 원장 성함", type: "text" },
  { id: "departments", label: "진료과목 · 주요 치료 질환 (주력 과목은 [주력] 표시)", type: "textarea", required: true },
  { id: "gender_ratio", label: "내원 환자 남/여 비율 (예: 남 45 : 여 55)", type: "text" },
  { id: "age_dist", label: "내원 환자 연령층 분포 (예: 21~30세 70%)", type: "textarea" },
  { id: "patient_region", label: "내원 환자 주요 거주 지역 (지역 타겟팅용)", type: "textarea" },
  { id: "new_patients", label: "일/주/월 신환 유입 수 · 유형별 유입 경로 비율", type: "textarea" },
  { id: "competitors", label: "주요 경쟁사(병원) 상호 · 경쟁사 마케팅 강점", type: "textarea" },
  { id: "ad_direction", label: "추구하는 온라인 광고 방향 · 참고 사이트 (톤앤매너 / 벤치마킹 / URL)", type: "textarea" },
  { id: "strengths", label: "당사만의 장점 · 차별점 · 강조하고 싶은 점", type: "textarea" },
  { id: "story_cases", label: "기억에 남는 진료/치료 사례 (개인정보 제외, 상황 위주 — 스토리텔링 소재)", type: "textarea" },
  { id: "philosophy", label: "원장님만의 특별한 치료 철학", type: "textarea" },
  { id: "rep_email", label: "대표 이메일", type: "text" },
  { id: "managers", label: "담당자 정보 (총괄/대표 · 브랜드 블로그 · 블로그 배포 담당 — 성함/연락처)", type: "textarea" },
  { id: "extra_notes", label: "그 밖에 공유할 자료 · 요청사항", type: "textarea" }
];

// 계약 대행범위에 맞춰 조건부로 붙는 채널 계정 정보 문항. (준비된 항목만 입력)
const CHANNEL_QUESTIONS: Record<string, SurveyQuestion[]> = {
  블로그: [{ id: "acct_blog", label: "네이버 블로그 계정 (아이디 / 비밀번호 — 준비된 항목만)", type: "textarea" }],
  플레이스: [{ id: "acct_place", label: "플레이스 / 검색광고 계정 (아이디 / 비밀번호)", type: "textarea" }],
  검색광고: [{ id: "acct_place", label: "플레이스 / 검색광고 계정 (아이디 / 비밀번호)", type: "textarea" }],
  SNS: [{ id: "acct_insta", label: "인스타그램 계정 (아이디 / 비밀번호)", type: "textarea" }]
};

// ── STEP 2. 중간 점검 설문 ── (매달 마감 후). 만족도·성과·콘텐츠 피드백 점검.
const MONTHLY_QUESTIONS: SurveyQuestion[] = [
  { id: "overall_satisfaction", label: "현재까지 진행된 마케팅 전반적 만족도 (1 매우 불만족 ~ 10 매우 만족)", type: "choice", options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], required: true, allowOther: true },
  { id: "effect_blog", label: "채널별 체감 효과 — 네이버 블로그(브랜드/배포)", type: "choice", options: ["매우 효과적", "효과적", "보통", "아쉬움", "잘 모르겠음"], allowOther: true },
  { id: "effect_place", label: "채널별 체감 효과 — 플레이스 / 검색광고", type: "choice", options: ["매우 효과적", "효과적", "보통", "아쉬움", "잘 모르겠음"], allowOther: true },
  { id: "effect_sns", label: "채널별 체감 효과 — 인스타그램 / SNS", type: "choice", options: ["매우 효과적", "효과적", "보통", "아쉬움", "잘 모르겠음"], allowOther: true },
  { id: "patient_change", label: "마케팅 시작 이후 신환 유입 / 문의량 변화", type: "choice", options: ["크게 증가", "다소 증가", "비슷함", "감소", "아직 파악 어려움"], allowOther: true },
  { id: "patient_change_detail", label: "구체적 수치·체감 변화 (예: 월 신환 120→150명)", type: "textarea" },
  { id: "attribution_case", label: "\"이 경로로 알고 왔다\"고 직접 확인된 사례 (블로그 후기 보고 내원, 지도 검색 후 방문 등)", type: "textarea" },
  { id: "content_good", label: "지금까지 발행된 콘텐츠 중 만족스러웠던 점", type: "textarea" },
  { id: "content_bad", label: "아쉬웠던 점 / 수정 요청", type: "textarea" },
  { id: "new_emphasis", label: "남은 기간 새롭게 강조하고 싶은 진료/서비스·이벤트 (신규 장비, 계절 질환, 신규 시술, 프로모션 등)", type: "textarea" },
  { id: "competitor_change", label: "경쟁사 동향 변화 (신규 오픈, 공격적 광고 등)", type: "textarea" },
  { id: "manager_comm", label: "담당 매니저와의 소통 (응대 속도·이해도·보고)", type: "choice", options: ["매우 만족", "만족", "보통", "불만족"], allowOther: true },
  { id: "manager_comm_note", label: "소통 관련 요청사항", type: "textarea" },
  { id: "improvement", label: "그 밖에 개선을 바라는 점이나 요청사항", type: "textarea" }
];

// 계약서 대행범위(라벨)를 설문 카테고리로 매핑 — 계약에 담긴 범위에 맞춰 채널 문항 생성.
function scopeLabelToCategories(label: string): string[] {
  const l = label.toLowerCase();
  const cats: string[] = [];
  if (label.includes("블로그")) cats.push("블로그");
  if (label.includes("플레이스")) cats.push("플레이스");
  if (l.includes("sns") || label.includes("인스타") || label.includes("페이스북")) cats.push("SNS");
  if (label.includes("파워링크") || label.includes("검색광고") || label.includes("파워콘텐츠") || label.includes("파워콘텐트")) cats.push("검색광고");
  return cats;
}

// 계약서 기본 내용 → 설문 문항 기본값(prefill). 계약에서 이미 아는 값을 미리 채워 재입력을 줄인다.
function prefillFromContract(
  questions: SurveyQuestion[],
  prefill: Record<string, string | null | undefined>
): SurveyQuestion[] {
  return questions.map((q) => {
    const v = prefill[q.id];
    return v && v.trim() ? { ...q, default: v.trim() } : q;
  });
}

// 시작 설문 = 공통 문항 + 계약 대행범위에 맞는 채널 계정 문항.
function buildStartQuestions(categories: string[], prefill: Record<string, string | null | undefined>): SurveyQuestion[] {
  const out = [...START_QUESTIONS];
  const seen = new Set(out.map((q) => q.id));
  const cats = new Set(categories.filter(Boolean));
  const catList = cats.size > 0 ? [...cats] : ["블로그", "플레이스", "SNS"]; // 범위 불명 시 기본 채널 전부
  for (const c of catList) {
    for (const q of CHANNEL_QUESTIONS[c] ?? []) {
      if (!seen.has(q.id)) {
        out.push(q);
        seen.add(q.id);
      }
    }
  }
  return prefillFromContract(out, prefill);
}

export async function createSurveyForContract(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({
      contractId: z.string().min(1),
      kind: z.enum(["START", "MONTHLY"]).optional(),
      round: z.coerce.number().int().positive().optional()
    }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const contract = await db.contract.findUnique({
      where: { id: p.data.contractId },
      select: {
        id: true, clientId: true, title: true, details: true,
        client: { select: { assignedMarketerId: true, name: true } },
        products: { select: { product: { select: { category: true } } } }
      }
    });
    if (!contract) throw new Error("NOT_FOUND");
    const scopes = await getAdminScopes(user);
    assertCanAccessClient(user, contract.clientId, scopes, contract.client.assignedMarketerId);

    // 설문 종류: 시작 전(START, 1회) / 매달 마감 후(MONTHLY, 반복).
    const kind = p.data.kind ?? (p.data.round && p.data.round >= 2 ? "MONTHLY" : "START");
    const name = contract.client.name;

    let round: number;
    let questions: SurveyQuestion[];
    let title: string;
    if (kind === "MONTHLY") {
      // 마감 점검은 회차 누적: 기존 마감 설문 수 + 1차부터. round 2 → 1차.
      const prior = await db.survey.count({ where: { contractId: contract.id, round: { gte: 2 } } });
      round = prior + 2;
      questions = MONTHLY_QUESTIONS;
      title = `${name} 마케팅 중간 점검 설문 (${round - 1}차)`;
    } else {
      // 카테고리 = 계약 상품 분류 ∪ 계약서 대행범위(details.scopeItems)에서 유추.
      const details = parseContractDetails(contract.details);
      const scopeItems = resolveScopeItems(details);
      const categories = [
        ...contract.products.map((cp) => cp.product.category),
        ...scopeItems.flatMap((it) => scopeLabelToCategories(it.label))
      ];
      round = 1;
      // 계약서에 있는 기본 내용을 문항 기본값으로 동기화(재입력 최소화).
      questions = buildStartQuestions(categories, {
        hospital_name: name,
        rep_name: details.clientCeo
      });
      title = `${name} 마케팅 시작 설문`;
    }

    const meta = await requestMeta();
    const orgId = await getDefaultOrgId();
    const created = await db.$transaction(async (tx) => {
      const survey = await tx.survey.create({
        data: {
          clientId: contract.clientId,
          contractId: contract.id,
          title,
          questions,
          round,
          publicToken: crypto.randomUUID(),
          orgId
        }
      });
      await recordAudit(tx, { actorId: user.id, action: "survey.create", targetType: "Survey", targetId: survey.id, afterState: { contractId: contract.id, kind, round, questions: questions.length }, ...meta });
      return survey;
    });

    revalidatePath(`/contracts/${contract.id}`);
    revalidatePath(`/clients/${contract.clientId}`);
    return { id: created.id };
  });
}

async function loadSurveyForEdit(surveyId: string) {
  const survey = await db.survey.findUnique({ where: { id: surveyId }, select: { id: true, clientId: true, contractId: true, client: { select: { assignedMarketerId: true } } } });
  if (!survey) throw new Error("NOT_FOUND");
  return survey;
}

export async function sendSurvey(input: unknown): Promise<ActionResult<{ delivery: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1), sentVia: z.enum(["LINK", "KAKAO", "SMS", "EMAIL"]).optional() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const survey = await loadSurveyForEdit(p.data.id);
    const scopes = await getAdminScopes(user);
    assertCanAccessClient(user, survey.clientId, scopes, survey.client.assignedMarketerId);
    const via = p.data.sentVia ?? "LINK";

    // 카카오 알림톡 선택 시 발송 시도(미연동/실패면 링크 복사로 폴백).
    let deliveryNote: string | undefined;
    if (via === "KAKAO") {
      const detail = await db.survey.findUnique({ where: { id: p.data.id }, select: { publicToken: true, title: true, client: { select: { contactPhone: true } } } });
      const base = appBaseUrl();
      const phone = detail?.client.contactPhone ?? "";
      if (!phone) deliveryNote = "수신 연락처 없음 — 링크로 전달하세요";
      else {
        const link = base ? `${base}/survey/${detail!.publicToken}` : undefined;
        const r = await sendAlimtalk({ to: phone, text: `[베놈] ${detail!.title} 설문을 부탁드립니다.`, link });
        deliveryNote = r.ok ? "알림톡 발송됨" : r.provider === "none" ? "알림톡 미연동 — 링크로 전달하세요" : `알림톡 실패(${r.skipped}) — 링크로 전달하세요`;
      }
    }

    const delivery = deliveryNote ?? (via === "LINK" ? "링크 발송 표시됨 — 링크를 복사해 전달하세요" : "발송 처리됨");
    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.survey.update({ where: { id: p.data.id }, data: { status: "SENT", sentVia: via, sentAt: new Date() } });
      await recordAudit(tx, { actorId: user.id, action: "survey.send", targetType: "Survey", targetId: p.data.id, afterState: { sentVia: via, delivery }, ...meta });
    });
    revalidatePath(`/clients/${survey.clientId}`);
    if (survey.contractId) revalidatePath(`/contracts/${survey.contractId}`);
    return { delivery };
  });
}

export async function deleteSurvey(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const survey = await loadSurveyForEdit(p.data.id);
    const scopes = await getAdminScopes(user);
    assertCanAccessClient(user, survey.clientId, scopes, survey.client.assignedMarketerId);

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.survey.delete({ where: { id: p.data.id } });
      await recordAudit(tx, { actorId: user.id, action: "survey.delete", targetType: "Survey", targetId: p.data.id, ...meta });
    });
    revalidatePath(`/clients/${survey.clientId}`);
    if (survey.contractId) revalidatePath(`/contracts/${survey.contractId}`);
  });
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// 외부(거래처) 응답 제출 — 로그인 불필요. publicToken으로만 접근.
// 완료 시: 설문 키워드 답변으로 콘텐츠 기획(PLANNED) 자동 생성 + 담당자 알림.
export async function submitSurveyResponse(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const p = z.object({ token: z.string().min(1), answers: z.record(z.string(), z.string()) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const survey = await db.survey.findUnique({
      where: { publicToken: p.data.token },
      select: { id: true, status: true, clientId: true, orgId: true, title: true, client: { select: { name: true, assignedMarketerId: true } } }
    });
    if (!survey) throw new Error("NOT_FOUND");
    if (survey.status === "COMPLETED") throw new Error("ALREADY_SUBMITTED");

    // 응답에 노출 키워드가 담긴 경우에만 콘텐츠 기획 초안(최대 5개)을 자동 생성.
    const kwRaw = p.data.answers["keywords"] ?? "";
    const keywords = kwRaw.split(/[,\n]/).map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 5);
    const month = currentMonth();

    await db.$transaction(async (tx) => {
      await tx.surveyResponse.create({ data: { surveyId: survey.id, answers: p.data.answers } });
      await tx.survey.update({ where: { id: survey.id }, data: { status: "COMPLETED" } });

      const plans = keywords.map((kw) => ({ topic: `${kw} 콘텐츠 기획`, keyword: kw }));
      for (const pl of plans) {
        await tx.contentPlan.create({
          data: { clientId: survey.clientId, month, topic: pl.topic, keyword: pl.keyword, status: "PLANNED", orgId: survey.orgId }
        });
      }

      // 담당 마케터에게 알림(외부 제출이라 actorId 없음).
      if (survey.client.assignedMarketerId) {
        await tx.notification.create({
          data: {
            userId: survey.client.assignedMarketerId,
            type: "SURVEY_COMPLETED",
            title: `${survey.client.name} 설문 응답 완료`,
            body: plans.length > 0 ? `콘텐츠 기획 ${plans.length}건이 자동 생성되었습니다.` : "설문 응답이 도착했습니다.",
            link: `/clients/${survey.clientId}`,
            targetType: "Survey",
            targetId: survey.id,
            orgId: survey.orgId
          }
        });
      }
    });

    revalidatePath(`/clients/${survey.clientId}`);
  });
}
