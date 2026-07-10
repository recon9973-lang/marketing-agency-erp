// 목표 경로: src/app/survey/[token]/page.tsx
//
// 외부 설문 응답 페이지 — 로그인 불필요(공개 토큰). (erp) 레이아웃 밖.
import { PublicSurveyForm } from "@/components/survey/PublicSurveyForm";
import { getSurveyByToken } from "@/server/repositories/surveys";

export const dynamic = "force-dynamic";

export default async function PublicSurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const survey = await getSurveyByToken(token);

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-surface px-4 py-10">
      {!survey ? (
        <div className="rounded-xl border border-line bg-white p-8 text-center text-slate-500">유효하지 않은 설문 링크입니다.</div>
      ) : survey.status === "COMPLETED" ? (
        <div className="rounded-xl border border-line bg-white p-8 text-center">
          <p className="text-2xl">✅</p>
          <p className="mt-2 text-lg font-bold text-ink">이미 제출된 설문입니다</p>
          <p className="mt-1 text-sm text-slate-500">감사합니다.</p>
        </div>
      ) : (
        <>
          <header className="mb-5">
            <p className="text-xs font-semibold text-brand-strong">주식회사 베놈</p>
            <h1 className="mt-1 text-xl font-bold text-ink">{survey.title}</h1>
            <p className="mt-1 text-sm text-slate-500">맞춤 마케팅을 위해 아래 항목을 작성해 주세요. (<span className="text-danger">*</span> 필수)</p>
          </header>
          <PublicSurveyForm token={token} questions={survey.questions} />
        </>
      )}
    </main>
  );
}
