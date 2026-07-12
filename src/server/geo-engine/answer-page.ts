// 목표 경로: src/server/geo-engine/answer-page.ts
//
// GEO 실행 자동화 #2 — 승인 질문 → 근거형 답변 페이지 초안 자동 생성.
// 산출물은 기존 콘텐츠 파이프라인(ContentPlan)으로 흘려보내
// 의료법 자동검수 → 내부검수 → 병원 승인(포털) → 게시 게이트를 그대로 통과시킨다.
// 게시(publishedUrl) 시 질문의 targetPageUrl이 자동으로 채워진다(content-plans 훅).

import { db } from "@/server/db";
import { generateGeoAnswerPage, type GeoAnswerDraft } from "@/server/ai/claude";
import { checkMedicalLaw } from "@/server/compliance/medical-law";
import { getDefaultOrgId } from "@/server/org";

/** FAQPage JSON-LD — 답변 페이지 게시 시 <script type="application/ld+json">로 삽입할 구조화 데이터. */
export function buildFaqJsonLd(draft: GeoAnswerDraft): unknown {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: draft.title,
        description: draft.summary,
        articleBody: draft.sections.map((s) => s.body).join("\n\n")
      },
      ...(draft.faq.length
        ? [
            {
              "@type": "FAQPage",
              mainEntity: draft.faq.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a }
              }))
            }
          ]
        : [])
    ]
  };
}

/** 게시용 마크다운 — BLUF(핵심 답변 선두) + 섹션 + FAQ + 주의 문구 + JSON-LD. */
export function buildAnswerPageMarkdown(draft: GeoAnswerDraft): string {
  const parts: string[] = [];
  parts.push(`# ${draft.title}`);
  parts.push("");
  parts.push(draft.summary); // BLUF — AI 인용 최적화의 핵심(첫 문단에 답)
  for (const s of draft.sections) {
    parts.push("");
    parts.push(`## ${s.heading}`);
    parts.push(s.body);
  }
  if (draft.faq.length) {
    parts.push("");
    parts.push("## 자주 묻는 질문");
    for (const f of draft.faq) {
      parts.push(`**Q. ${f.q}**`);
      parts.push(`A. ${f.a}`);
      parts.push("");
    }
  }
  parts.push(`> ${draft.caution}`);
  parts.push("");
  parts.push("<!-- FAQPage 구조화 데이터 — 게시 시 <head> 또는 본문에 삽입 -->");
  parts.push("```json");
  parts.push(JSON.stringify(buildFaqJsonLd(draft), null, 2));
  parts.push("```");
  return parts.join("\n");
}

export type AnswerPageResult = { planId: string; high: number; medium: number };

/**
 * 질문 1건 → 답변 페이지 초안 생성 → ContentPlan(DRAFTED)으로 저장 + 질문에 링크.
 * 의료법 자동검수 결과(complianceRisk)가 함께 저장되어 high 위험 시 게시가 잠긴다.
 */
export async function createAnswerPagePlan(questionId: string): Promise<AnswerPageResult> {
  const question = await db.geoQuestion.findUnique({
    where: { id: questionId },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          region: true,
          hospitalProfile: {
            select: { departments: true, strengths: true, preferredTone: true, prohibitedClaims: true }
          }
        }
      }
    }
  });
  if (!question) throw new Error("NOT_FOUND");
  if (question.answerPlanId) throw new Error("ALREADY_GENERATED");

  const profile = question.client.hospitalProfile;
  const draft = await generateGeoAnswerPage({
    question: question.question,
    hospitalName: question.client.name,
    department: question.department ?? profile?.departments?.split(/[,\n]/)[0]?.trim(),
    region: question.client.region,
    strengths: profile?.strengths,
    preferredTone: profile?.preferredTone,
    prohibited: profile?.prohibitedClaims
  });

  const markdown = buildAnswerPageMarkdown(draft);
  const combined = [draft.title, draft.summary, ...draft.sections.flatMap((s) => [s.heading, s.body]), ...draft.faq.flatMap((f) => [f.q, f.a]), draft.caution].join("\n");
  const check = checkMedicalLaw(combined, profile?.prohibitedClaims);

  const orgId = await getDefaultOrgId();
  const month = new Date().toISOString().slice(0, 7);

  const planId = await db.$transaction(async (tx) => {
    const plan = await tx.contentPlan.create({
      data: {
        clientId: question.client.id,
        month,
        topic: `[GEO 답변] ${question.question.slice(0, 150)}`,
        angle: draft.summary,
        faq: draft.faq.map((f) => f.q),
        qa: draft.faq,
        draft: markdown,
        complianceRisk: { high: check.highCount, medium: check.mediumCount, flags: check.flags },
        status: "DRAFTED",
        orgId
      }
    });
    await tx.geoQuestion.update({ where: { id: questionId }, data: { answerPlanId: plan.id } });
    return plan.id;
  });

  return { planId, high: check.highCount, medium: check.mediumCount };
}
