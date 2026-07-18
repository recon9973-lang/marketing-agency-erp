// CEP 파인더 — GEO Studio M2(cep_finder) 화면.
// 소비자가 4대 AI에 묻는 순간의 상황·맥락(CEP)을 발굴·태깅·점수화(현재 목 파이프라인).
// 서버 컴포넌트: GET 폼 → searchParams로 서버에서 discoverCeps 실행·렌더(클라이언트 액션 없음 → 안정적).
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCurrentUser } from "@/server/session";
import { discoverCeps } from "@/server/geo-studio/cep/finder";
import { buildBrief } from "@/server/geo-studio/cep/brief";
import { briefToMarkdown, makeCep } from "@/server/geo-studio/cep/models";
import { ClusterBubbleMap, type BubbleCep } from "@/components/geo-cep/ClusterBubbleMap";
import { TierBadge } from "@/components/geo-common/TierBadge";
import { Sparkline } from "@/components/geo-common/Sparkline";
import { GptReviewPanel } from "@/components/geo-cep/GptReviewPanel";
import { SerpTable } from "@/components/geo-cep/SerpTable";
import { buildGptReview, type ReviewReport } from "@/server/geo-studio/cep/review";
import { getProvider } from "@/server/geo-studio/providers/resolver";

const AXES: [string, string][] = [
  ["situation_tag", "상황"],
  ["emotion_tag", "감성"],
  ["time_tag", "시간"],
  ["place_tag", "장소"],
  ["companion_tag", "동반"]
];

const csv = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

type CepRow = {
  cep_text: string;
  situation_tag: string;
  emotion_tag: string;
  time_tag: string;
  place_tag: string;
  companion_tag: string;
  priority_score: number;
  ai_mention_count: number;
  is_whitespace: boolean;
};

export default async function GeoCepPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const brand = one(sp.brand) ?? "";
  const category = one(sp.category) ?? "";
  const competitorsStr = one(sp.competitors) ?? "";
  const keywordsStr = one(sp.keywords) ?? "";
  const ran = Boolean(brand && category);

  const report = ran
    ? (discoverCeps(brand, category, { competitors: csv(competitorsStr), extraKeywords: csv(keywordsStr) }) as unknown as {
        probe_count: number;
        candidate_count: number;
        total_ceps: number;
        whitespace_count: number;
        ceps: CepRow[];
        whitespace_ceps: string[];
        cep_share: Record<string, number>;
      })
    : null;

  let briefMd: string | null = null;
  if (report && report.ceps[0]) {
    const t = report.ceps[0];
    briefMd = briefToMarkdown(
      buildBrief(
        makeCep({ cepText: t.cep_text, situationTag: t.situation_tag, emotionTag: t.emotion_tag, timeTag: t.time_tag, placeTag: t.place_tag, companionTag: t.companion_tag }),
        "blog",
        brand
      )
    );
  }

  const review = report ? buildGptReview(report as unknown as ReviewReport, brand, category) : null;
  const provider = getProvider();
  const serpDocs = ran ? await provider.serpTop(category, 8) : [];
  const serpTier = provider.tierOf("serpTop");
  const monthlyVol = ran ? await provider.monthlyVolume(category) : null;
  const volTier = provider.tierOf("monthlyVolume");
  const volFmt = new Intl.NumberFormat("ko-KR");
  const trend = ran ? await provider.searchVolume(category, "m") : [];
  const trendTier = provider.tierOf("searchVolume");
  const trendLatest = trend.length ? Math.round(trend[trend.length - 1].value * 10) / 10 : null;
  const trendDelta = trend.length >= 2 ? Math.round((trend[trend.length - 1].value - trend[0].value) * 10) / 10 : null;

  const input = "mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none";

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="GEO Studio · M2"
        title="CEP 파인더"
        description="소비자가 4대 AI(ChatGPT·Gemini·Claude·Perplexity)에 묻는 순간의 상황·맥락(Category Entry Point)을 발굴합니다. 5차원 태깅·우선순위 점수·경쟁사 점유·화이트스페이스·콘텐츠 브리프까지 산출합니다."
      />

      {/* 입력 폼(GET) */}
      <form method="get" className="rounded-2xl border border-line bg-card p-4">
        <p className="mb-3 text-sm font-bold text-ink">발굴 입력</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-medium text-slate-600">브랜드
            <input name="brand" defaultValue={brand || "햇살숙소"} className={input} />
          </label>
          <label className="block text-xs font-medium text-slate-600">카테고리
            <input name="category" defaultValue={category || "제주 숙소"} className={input} />
          </label>
          <label className="block text-xs font-medium text-slate-600">경쟁사 (쉼표)
            <input name="competitors" defaultValue={competitorsStr || "블루하우스, 코지스테이"} className={input} />
          </label>
          <label className="block text-xs font-medium text-slate-600">보조 키워드 (쉼표)
            <input name="keywords" defaultValue={keywordsStr || "제주 펜션"} className={input} />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            🔍 CEP 발굴
          </button>
          <span className="text-[11px] text-slate-400">4대 AI 인터로게이션 → 클러스터링 → 5차원 태깅·점수화 (현재 목 파이프라인)</span>
        </div>
      </form>

      {report && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "프로브", value: report.probe_count },
              { label: "CEP 후보", value: report.candidate_count },
              { label: "발굴 CEP", value: report.total_ceps },
              { label: "화이트스페이스", value: report.whitespace_count }
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-line bg-card p-4">
                <p className="text-[11px] text-slate-500">{c.label}</p>
                <p className="text-xl font-bold text-ink">{c.value}</p>
              </div>
            ))}
          </div>

          {monthlyVol && (
            <div className="rounded-2xl border border-line bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-sm font-bold text-ink">카테고리 월 검색량 — “{category}”</p>
                <TierBadge tier={volTier} note={volTier === "measured" ? "네이버 검색광고" : "데모 추정"} />
              </div>
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                  <p className="text-[11px] text-slate-500">합계(월간)</p>
                  <p className="text-2xl font-bold text-ink">{monthlyVol.total != null ? volFmt.format(monthlyVol.total) : "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">PC</p>
                  <p className="text-base font-semibold text-slate-600">{monthlyVol.pc != null ? volFmt.format(monthlyVol.pc) : "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">모바일</p>
                  <p className="text-base font-semibold text-slate-600">{monthlyVol.mobile != null ? volFmt.format(monthlyVol.mobile) : "-"}</p>
                </div>
                {monthlyVol.competition && (
                  <div>
                    <p className="text-[11px] text-slate-500">경쟁도</p>
                    <p className="text-base font-semibold text-slate-600">{monthlyVol.competition}</p>
                  </div>
                )}
                {trend.length >= 2 && (
                  <div className="ml-auto flex items-center gap-3 border-l border-line pl-4">
                    <div>
                      <p className="flex items-center gap-1 text-[11px] text-slate-500">관심 추세 <TierBadge tier={trendTier} note={trendTier === "measured" ? "데이터랩" : "데모"} /></p>
                      <p className="text-base font-semibold text-slate-700">
                        {trendLatest}<span className="text-[11px] text-slate-400">/100</span>
                        {trendDelta != null && (
                          <span className={`ml-1 text-xs ${trendDelta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                            {trendDelta >= 0 ? "▲" : "▼"}{Math.abs(trendDelta)}
                          </span>
                        )}
                      </p>
                    </div>
                    <Sparkline points={trend} />
                  </div>
                )}
              </div>
            </div>
          )}

          <ClusterBubbleMap ceps={report.ceps as unknown as BubbleCep[]} seedLabel={category} />

          {review && <GptReviewPanel review={review} seedLabel={category} />}

          <div className="overflow-x-auto rounded-2xl border border-line bg-card">
            <div className="flex items-center gap-2 px-4 pt-4">
              <p className="text-sm font-bold text-ink">발굴된 CEP (우선순위순)</p>
              <TierBadge tier="approx" note="목 파이프라인" />
            </div>
            <table className="mt-2 w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="border-y border-line bg-surface text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-2">CEP</th>
                  <th className="px-2 py-2">5차원 태그</th>
                  <th className="px-2 py-2">우선순위</th>
                  <th className="px-2 py-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {report.ceps.slice(0, 20).map((c, i) => (
                  <tr key={i} className="border-t border-line align-top">
                    <td className="px-4 py-2 font-medium text-ink">{c.cep_text}</td>
                    <td className="px-2 py-2">
                      <span className="flex flex-wrap gap-1">
                        {AXES.map(([k, lbl]) =>
                          (c as unknown as Record<string, string>)[k] ? (
                            <span key={k} className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-slate-600">
                              {lbl}:{(c as unknown as Record<string, string>)[k]}
                            </span>
                          ) : null
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-2 font-semibold text-emerald-700">{c.priority_score}</td>
                    <td className="px-2 py-2">
                      {c.is_whitespace ? (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">화이트스페이스</span>
                      ) : c.ai_mention_count > 0 ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">자사 언급</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">경쟁</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SerpTable docs={serpDocs} tier={serpTier} keyword={category} />

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-card p-4">
              <p className="mb-3 text-sm font-bold text-ink">CEP 점유율</p>
              <div className="space-y-2">
                {Object.entries(report.cep_share).map(([name, pct]) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{name === "_brand" ? "자사" : name}</span>
                      <span className="text-slate-400">{pct}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-surface">
                      <div className={`h-2 rounded-full ${name === "_brand" ? "bg-emerald-500" : "bg-slate-400"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-card p-4">
              <p className="mb-2 text-sm font-bold text-ink">🎯 화이트스페이스 CEP (선점 기회)</p>
              {report.whitespace_ceps.length ? (
                <ul className="space-y-1">
                  {report.whitespace_ceps.slice(0, 12).map((t, i) => (
                    <li key={i} className="text-xs text-slate-600">· {t}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">화이트스페이스 CEP 없음</p>
              )}
            </div>
          </div>

          {briefMd && (
            <details className="rounded-2xl border border-line bg-card p-4">
              <summary className="cursor-pointer text-sm font-bold text-ink">최우선 CEP → 콘텐츠 브리프 (M3 입력)</summary>
              <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 text-[12px] leading-relaxed text-slate-700">
                {briefMd}
              </pre>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
