// 목표 경로: src/server/actions/surveys.ts
//
// 설문폼 — 계약 상품 기반 자동 생성 → (담당자 확인) → 발송 → 외부 응답 수신.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertCanAccessClient } from "@/domain/access-control";
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

export type SurveyQuestion = { id: string; label: string; type: "text" | "textarea" | "choice"; options?: string[]; required?: boolean };

// 병원 기본 문항(planning §C). 모든 설문 공통.
const BASE_QUESTIONS: SurveyQuestion[] = [
  { id: "hospital_name", label: "병원명", type: "text", required: true },
  { id: "departments", label: "진료과목", type: "text", required: true },
  { id: "doctors", label: "대표원장·의료진 소개", type: "textarea" },
  { id: "strengths", label: "병원 강점·차별점", type: "textarea" },
  { id: "prohibited", label: "사용을 피해야 할 표현(의료법 주의)", type: "textarea" },
  { id: "tone", label: "선호하는 문체·톤", type: "text" },
  { id: "competitors", label: "경쟁 병원", type: "text" },
  { id: "keywords", label: "노출을 원하는 키워드", type: "textarea" },
  { id: "photos", label: "제공 가능한 사진·자료", type: "choice", options: ["있음", "일부 있음", "없음"] },
  { id: "events", label: "진행 중이거나 예정된 이벤트", type: "textarea" },
  { id: "notes", label: "기타 요청·주의사항", type: "textarea" }
];

// 상품 카테고리별 추가 문항.
const CATEGORY_QUESTIONS: Record<string, SurveyQuestion[]> = {
  블로그: [{ id: "blog_topics", label: "블로그에서 다뤘으면 하는 주제", type: "textarea" }],
  플레이스: [
    { id: "place_hours", label: "영업시간", type: "text" },
    { id: "place_access", label: "주차·오시는 길", type: "textarea" }
  ],
  SNS: [{ id: "sns_handles", label: "운영 중인 SNS 계정(인스타/페북 등)", type: "text" }],
  검색광고: [
    { id: "ad_budget", label: "월 광고 예산(희망)", type: "text" },
    { id: "ad_landing", label: "광고 랜딩 URL", type: "text" }
  ]
};

function buildQuestions(categories: string[]): SurveyQuestion[] {
  const out = [...BASE_QUESTIONS];
  const seen = new Set(out.map((q) => q.id));
  for (const c of new Set(categories)) {
    for (const q of CATEGORY_QUESTIONS[c] ?? []) {
      if (!seen.has(q.id)) {
        out.push(q);
        seen.add(q.id);
      }
    }
  }
  return out;
}

export async function createSurveyForContract(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ contractId: z.string().min(1), round: z.coerce.number().int().positive().optional() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const contract = await db.contract.findUnique({
      where: { id: p.data.contractId },
      select: { id: true, clientId: true, title: true, client: { select: { assignedMarketerId: true, name: true } }, products: { select: { product: { select: { category: true } } } } }
    });
    if (!contract) throw new Error("NOT_FOUND");
    const scopes = await getAdminScopes(user);
    assertCanAccessClient(user, contract.clientId, scopes, contract.client.assignedMarketerId);

    const categories = contract.products.map((cp) => cp.product.category);
    const questions = buildQuestions(categories);

    const meta = await requestMeta();
    const orgId = await getDefaultOrgId();
    const created = await db.$transaction(async (tx) => {
      const survey = await tx.survey.create({
        data: {
          clientId: contract.clientId,
          contractId: contract.id,
          title: `${contract.client.name} 온보딩 설문`,
          questions,
          round: p.data.round ?? 1,
          publicToken: crypto.randomUUID(),
          orgId
        }
      });
      await recordAudit(tx, { actorId: user.id, action: "survey.create", targetType: "Survey", targetId: survey.id, afterState: { contractId: contract.id, questions: questions.length }, ...meta });
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

export async function sendSurvey(input: unknown): Promise<ActionResult> {
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

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.survey.update({ where: { id: p.data.id }, data: { status: "SENT", sentVia: via, sentAt: new Date() } });
      await recordAudit(tx, { actorId: user.id, action: "survey.send", targetType: "Survey", targetId: p.data.id, afterState: { sentVia: via, delivery: deliveryNote ?? "링크" }, ...meta });
    });
    revalidatePath(`/clients/${survey.clientId}`);
    if (survey.contractId) revalidatePath(`/contracts/${survey.contractId}`);
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

    // 응답의 키워드로 콘텐츠 기획 초안(최대 5개). 없으면 온보딩 기반 1개.
    const kwRaw = p.data.answers["keywords"] ?? "";
    const keywords = kwRaw.split(/[,\n]/).map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 5);
    const month = currentMonth();

    await db.$transaction(async (tx) => {
      await tx.surveyResponse.create({ data: { surveyId: survey.id, answers: p.data.answers } });
      await tx.survey.update({ where: { id: survey.id }, data: { status: "COMPLETED" } });

      const plans = keywords.length > 0
        ? keywords.map((kw) => ({ topic: `${kw} 콘텐츠 기획`, keyword: kw }))
        : [{ topic: "온보딩 설문 기반 콘텐츠 기획", keyword: null as string | null }];
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
            body: `콘텐츠 기획 ${plans.length}건이 자동 생성되었습니다.`,
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
