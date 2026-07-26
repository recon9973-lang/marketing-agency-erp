"use client";

import { useMemo, useState } from "react";
import { KeywordGap, SourceUpset, SourceVenn, StagePsychMatrix } from "@/components/journeymap/SetCharts";
import { buildPsychProfile, PSYCH_META } from "@/lib/journeymap/qpc";
import { buildClinicSchema, buildFaqSchema } from "@/lib/journeymap/schema";
import { lawUrl, RISK_DISCLAIMER } from "@/lib/journeymap/risk";
import { formatVolume, Project, STAGE_META, STAGES } from "@/lib/journeymap/types";

// 지표 등급 배지 (v2.1 §2 실측 우선 원칙 — F-953)
function GradeBadge({ grade }: { grade: "실측" | "산출" }) {
  return (
    <span
      className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        grade === "실측" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"
      }`}
      title={grade === "실측" ? "API·원문에서 직접 수집한 값" : "실측 원본에서 자체 공식으로 계산한 값"}
    >
      {grade}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
    >
      {copied ? "✅ 복사됨" : label}
    </button>
  );
}

export function DiagnosisView({ project }: { project: Project }) {
  const kwNodes = useMemo(() => project.nodes.filter((n) => n.kind === "keyword"), [project.nodes]);
  const centerNode = useMemo(() => project.nodes.find((n) => n.kind === "center"), [project.nodes]);

  const psych = useMemo(() => buildPsychProfile(project.nodes), [project.nodes]);
  const faq = useMemo(() => buildFaqSchema(project.nodes), [project.nodes]);
  const clinicSchema = useMemo(() => buildClinicSchema(project.profile), [project.profile]);

  const totalVolume =
    kwNodes.reduce((s, n) => s + (n.volumePc ?? 0) + (n.volumeMo ?? 0), 0) +
    ((centerNode?.volumePc ?? 0) + (centerNode?.volumeMo ?? 0));
  const withVolume = kwNodes.filter((n) => (n.volumePc ?? 0) + (n.volumeMo ?? 0) > 0);
  const red = kwNodes.filter((n) => n.riskLevel === "red");
  const yellow = kwNodes.filter((n) => n.riskLevel === "yellow");

  // 기회 키워드: 메인 키워드(중심 노드) 포함, 검색량 실측 우선·리스크 없는 키워드를 정렬
  const opportunities = useMemo(() => {
    const pool = [...(centerNode ? [centerNode] : []), ...kwNodes].filter((n) => n.riskLevel === "none");
    return pool
      .sort((a, b) => {
        const va = (a.volumePc ?? 0) + (a.volumeMo ?? 0);
        const vb = (b.volumePc ?? 0) + (b.volumeMo ?? 0);
        return vb - va || b.score - a.score;
      })
      .slice(0, 10);
  }, [kwNodes, centerNode]);

  const stageCounts = STAGES.map((s) => ({
    stage: s,
    count: kwNodes.filter((n) => n.stage === s).length,
  }));
  const maxStage = Math.max(...stageCounts.map((s) => s.count), 1);

  return (
    <div className="mx-auto max-w-5xl space-y-6 overflow-y-auto px-6 py-6">
      {/* ① 요약 카드 */}
      <section>
        <h2 className="mb-3 font-bold">📊 진단 요약 — {project.mainKeyword} × {project.profile.name}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">수집 키워드</p>
            <p className="text-2xl font-bold">{kwNodes.length}</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">
              월간 검색량 합<GradeBadge grade="실측" />
            </p>
            <p className="text-2xl font-bold">{formatVolume(totalVolume)}</p>
            <p className="text-[10px] text-slate-400">검색량 확보 {withVolume.length}개 키워드</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">실제 환자 질문</p>
            <p className="text-2xl font-bold">{psych.total}</p>
            <p className="text-[10px] text-slate-400">지식iN 실측</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">의료법 리스크</p>
            <p className="text-2xl font-bold">
              <span className="text-red-600">{red.length}</span> ·{" "}
              <span className="text-amber-600">{yellow.length}</span>
            </p>
            <p className="text-[10px] text-slate-400">금지 · 주의</p>
          </div>
        </div>
      </section>

      {/* ② 여정 단계 분포 */}
      <section className="rounded-xl border bg-white p-5">
        <h3 className="mb-3 text-sm font-bold">
          환자 여정 단계 분포<GradeBadge grade="산출" />
        </h3>
        <div className="space-y-2">
          {stageCounts.map(({ stage, count }) => (
            <div key={stage} className="flex items-center gap-3 text-sm">
              <span className="w-16 shrink-0" style={{ color: STAGE_META[stage].color }}>
                {STAGE_META[stage].label}
              </span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                <div
                  className="h-full rounded"
                  style={{ width: `${(count / maxStage) * 100}%`, background: STAGE_META[stage].color }}
                />
              </div>
              <span className="w-10 text-right text-xs text-slate-500">{count}개</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          비어있거나 적은 단계가 콘텐츠 공백 구간입니다 — 해당 단계용 콘텐츠를 보강하세요.
        </p>
      </section>

      {/* ③ 질문 심리 프로필 (QPC) */}
      <section className="rounded-xl border bg-white p-5">
        <h3 className="mb-1 text-sm font-bold">
          질문 심리 프로필<GradeBadge grade="산출" />
          <span className="ml-2 text-xs font-normal text-slate-400">
            실제 질문 {psych.total}건 중 {psych.classified}건 분류 (질문 원문은 실측)
          </span>
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          환자가 &ldquo;무엇이 걸려서&rdquo; 질문하는지 — 콘텐츠가 답해야 할 심리입니다.
        </p>
        {psych.distribution.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
            분류할 질문이 부족합니다. 지식iN 소스를 켜고 다시 수집하면 채워집니다.
          </p>
        ) : (
          <div className="space-y-4">
            {psych.distribution.map(({ code, count, ratio }) => (
              <div key={code} className="rounded-lg border p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-bold" style={{ color: PSYCH_META[code].color }}>
                    {PSYCH_META[code].label}
                  </span>
                  <span className="text-xs text-slate-500">
                    {Math.round(ratio * 100)}% ({count}건) — {PSYCH_META[code].desc}
                  </span>
                </div>
                <div className="mb-2 h-2 overflow-hidden rounded bg-slate-100">
                  <div
                    className="h-full rounded"
                    style={{ width: `${ratio * 100}%`, background: PSYCH_META[code].color }}
                  />
                </div>
                <ul className="mb-2 space-y-0.5 text-xs text-slate-600">
                  {psych.topQuestions[code].slice(0, 3).map((q, i) => (
                    <li key={i} className="truncate">
                      &ldquo;{q.keyword}&rdquo;
                      {q.sourceUrl && (
                        <a href={q.sourceUrl} target="_blank" rel="noreferrer" className="ml-1 text-blue-600 underline">
                          원본
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-slate-500">
                  💡 대응 방향: {PSYCH_META[code].direction}
                </p>
              </div>
            ))}
            {psych.classified < 10 && (
              <p className="text-[11px] text-amber-600">
                ⚠️ 표본 {psych.classified}건 — 표본이 적어 경향 참고용입니다 (실측 원칙).
              </p>
            )}
          </div>
        )}
      </section>

      {/* ③-1 교집합 분석: 벤 다이어그램 + 업셋 플롯 */}
      <section className="rounded-xl border bg-white p-5">
        <h3 className="mb-1 text-sm font-bold">
          수집 소스 교집합 분석<GradeBadge grade="실측" />
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          같은 키워드를 여러 경로(네이버·구글·검색광고·지식iN)가 동시에 발견했다면 — 실제 수요가 교차 검증된
          키워드입니다.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600">벤 다이어그램 (3개 소스)</p>
            <SourceVenn nodes={project.nodes} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600">업셋 플롯 (지식iN 포함 4개 소스 조합)</p>
            <SourceUpset nodes={project.nodes} />
          </div>
        </div>
      </section>

      {/* ③-2 여정 × 심리 매트릭스 */}
      <section className="rounded-xl border bg-white p-5">
        <h3 className="mb-1 text-sm font-bold">
          여정 단계 × 질문 심리 매트릭스<GradeBadge grade="산출" />
        </h3>
        <StagePsychMatrix nodes={project.nodes} />
      </section>

      {/* ③-3 키워드 갭 분석 */}
      <section className="rounded-xl border bg-white p-5">
        <h3 className="mb-1 text-sm font-bold">
          키워드 갭 — 자사 vs 경쟁 브랜드 수요<GradeBadge grade="실측" />
        </h3>
        <KeywordGap nodes={project.nodes} profile={project.profile} />
      </section>

      {/* ④ 기회 키워드 TOP 10 */}
      <section className="rounded-xl border bg-white p-5">
        <h3 className="mb-3 text-sm font-bold">
          기회 키워드 TOP 10
          <span className="ml-2 text-xs font-normal text-slate-400">
            검색량<GradeBadge grade="실측" /> × 점수<GradeBadge grade="산출" /> · 리스크 없는 키워드만
          </span>
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-slate-500">
              <th className="py-1.5">키워드</th>
              <th className="w-16">단계</th>
              <th className="w-20 text-right">월 검색량</th>
              <th className="w-14 text-right">점수</th>
              <th className="w-16 text-right">경쟁도</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((n) => (
              <tr key={n.id} className="border-b last:border-0">
                <td className="py-1.5">
                  {n.keyword}
                  {n.kind === "center" && (
                    <span className="ml-1.5 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      메인
                    </span>
                  )}
                </td>
                <td style={{ color: n.stage ? STAGE_META[n.stage].color : undefined }}>
                  {n.stage ? STAGE_META[n.stage].label.slice(2) : "-"}
                </td>
                <td className="text-right">{formatVolume((n.volumePc ?? 0) + (n.volumeMo ?? 0) || null)}</td>
                <td className="text-right font-semibold">{n.score}</td>
                <td className="text-right text-xs">{n.competition ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ⑤ 리스크 목록 */}
      {(red.length > 0 || yellow.length > 0) && (
        <section className="rounded-xl border bg-white p-5">
          <h3 className="mb-3 text-sm font-bold">의료법 리스크 키워드</h3>
          <ul className="space-y-1 text-sm">
            {[...red, ...yellow].slice(0, 12).map((n) => (
              <li key={n.id} className="flex items-start gap-2">
                <span>{n.riskLevel === "red" ? "🔴" : "🟡"}</span>
                <span>
                  {n.keyword}
                  <span className="ml-2 text-xs text-slate-500">
                    {n.riskReasons[0]?.law} — {n.riskReasons[0]?.description}
                    {n.riskReasons[0] && lawUrl(n.riskReasons[0].law) && (
                      <a
                        href={lawUrl(n.riskReasons[0].law)!}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 text-blue-600 underline"
                      >
                        조문 ↗
                      </a>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-slate-400">{RISK_DISCLAIMER}</p>
        </section>
      )}

      {/* ⑥ 스키마 패키지 (F-952) */}
      <section className="rounded-xl border bg-white p-5">
        <h3 className="mb-1 text-sm font-bold">
          스키마 패키지<GradeBadge grade="산출" />
          <span className="ml-2 text-xs font-normal text-slate-400">홈페이지 &lt;head&gt;에 넣는 구조화 데이터 — AI 검색·리치결과 노출용</span>
        </h3>

        <div className="mt-3 space-y-5">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-600">
                ① FAQPage — 실제 환자 질문 {faq.included}개 기반
              </p>
              <CopyButton text={faq.jsonLd} label="📋 복사" />
              <a
                className="text-xs text-blue-600 underline"
                href="https://search.google.com/test/rich-results"
                target="_blank"
                rel="noreferrer"
              >
                구글 리치결과 테스트
              </a>
            </div>
            {faq.excludedRed > 0 && (
              <p className="mb-1 text-[11px] text-red-600">
                🔴 의료법 금지 표현 포함 질문 {faq.excludedRed}건은 자동 제외했습니다 (의료법 게이트).
              </p>
            )}
            <p className="mb-2 text-[11px] text-amber-600">
              ⚠️ 답변 칸은 의료진이 검수·작성해야 합니다. 게시 전 의료인 감수를 권장합니다.
            </p>
            <pre className="max-h-56 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-snug text-slate-100">
              {faq.jsonLd}
            </pre>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-600">② MedicalClinic — 병원 정보</p>
              <CopyButton text={clinicSchema} label="📋 복사" />
            </div>
            <p className="mb-2 text-[11px] text-slate-500">
              홈페이지 주소·전화번호는 표시된 자리에 직접 채워 넣으세요.
            </p>
            <pre className="max-h-40 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-snug text-slate-100">
              {clinicSchema}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
