// 목표 경로: src/server/repositories/surveys.ts
//
// 설문 조회. 내부용(권한은 호출부에서) + 공개 토큰 조회.
import { db } from "@/server/db";
import type { SurveyQuestion } from "@/server/actions/surveys";

export type SurveyListItem = {
  id: string;
  title: string;
  status: string;
  round: number;
  publicToken: string;
  questions: SurveyQuestion[];
  responses: { answers: Record<string, string>; submittedAt: string }[];
  createdAt: string;
};

/** 계약의 설문 목록(내부, 문항·응답 포함). */
export async function listSurveysForContract(contractId: string): Promise<SurveyListItem[]> {
  const rows = await db.survey.findMany({
    where: { contractId },
    orderBy: { createdAt: "desc" },
    include: { responses: { orderBy: { submittedAt: "desc" } } }
  });
  return rows.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    round: s.round,
    publicToken: s.publicToken,
    questions: Array.isArray(s.questions) ? (s.questions as unknown as SurveyQuestion[]) : [],
    responses: s.responses.map((r) => ({ answers: (r.answers as Record<string, string>) ?? {}, submittedAt: r.submittedAt.toISOString() })),
    createdAt: s.createdAt.toISOString()
  }));
}

export type PublicSurvey = { title: string; status: string; questions: SurveyQuestion[] } | null;

/** 공개 응답 페이지용 — 토큰으로만 조회(로그인 불필요). */
export async function getSurveyByToken(token: string): Promise<PublicSurvey> {
  const s = await db.survey.findUnique({ where: { publicToken: token }, select: { title: true, status: true, questions: true } });
  if (!s) return null;
  return { title: s.title, status: s.status, questions: Array.isArray(s.questions) ? (s.questions as unknown as SurveyQuestion[]) : [] };
}

export type SurveyDetail = {
  title: string;
  questions: SurveyQuestion[];
  responses: { id: string; answers: Record<string, string>; submittedAt: string }[];
} | null;

/** 설문 상세 + 응답(내부, 권한은 호출부에서 거래처 접근으로 확인). */
export async function getSurveyDetail(surveyId: string): Promise<SurveyDetail> {
  const s = await db.survey.findUnique({
    where: { id: surveyId },
    include: { responses: { orderBy: { submittedAt: "desc" } } }
  });
  if (!s) return null;
  return {
    title: s.title,
    questions: Array.isArray(s.questions) ? (s.questions as unknown as SurveyQuestion[]) : [],
    responses: s.responses.map((r) => ({ id: r.id, answers: (r.answers as Record<string, string>) ?? {}, submittedAt: r.submittedAt.toISOString() }))
  };
}
