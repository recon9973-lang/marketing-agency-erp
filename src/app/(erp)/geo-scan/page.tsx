// GEO 스캐너 — GEO Studio M1(geo_scanner) 화면.
// 4대 AI(ChatGPT·Gemini·Claude·Perplexity)가 브랜드를 얼마나 인용하는지 측정(현재 목 파이프라인).
// 서버 컴포넌트: GET 폼 → searchParams로 서버에서 scan() 실행·렌더(클라이언트 액션 없음 → 안정적).
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCurrentUser } from "@/server/session";
import { scan, scanLive, anyPlatformLive } from "@/server/geo-studio/scanner/scanner";
import { todayIso } from "@/server/geo-studio/py-compat";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { TierBadge } from "@/components/geo-common/TierBadge";

const csv = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const AI_LABEL: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", claude: "Claude", perplexity: "Perplexity" };

type ByAi = { rate: number; mentioned: number; total: number; errors: number; avg_response_ms: number; mocked: boolean; contexts: string[] };
type Competitor = { name: string; overall_rate: number; by_ai: Record<string, number> };

export default async function GeoScanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const brand = one(sp.brand) ?? "";
  const keywordsStr = one(sp.keywords) ?? "";
  const competitorsStr = one(sp.competitors) ?? "";
  const keywords = csv(keywordsStr);
  const ran = Boolean(brand && keywords.length);

  // 실측 우선 — 연결된 엔진이 있으면 실제 AI 호출(scanLive), 없으면 목(scan).
  const live = anyPlatformLive();
  type ScanReport = {
    brand: string;
    overall_mention_rate: number;
    total_queries: number;
    by_ai: Record<string, ByAi>;
    by_keyword: Record<string, number>;
    competitors: Competitor[];
    mocked?: boolean;
    live?: boolean;
  };
  const report = ran
    ? ((live
        ? await scanLive(brand, keywords, csv(competitorsStr), undefined, 3, todayIso())
        : scan(brand, keywords, csv(competitorsStr), undefined, 3, todayIso())) as unknown as ScanReport)
    : null;

  const input = "mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none";
  const rateColor = (r: number) => (r >= 50 ? "text-emerald-700" : r >= 25 ? "text-amber-600" : "text-slate-500");

  const contexts = report ? Object.values(report.by_ai).flatMap((a) => a.contexts) : [];

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="GEO Studio · M1"
        title="GEO 스캐너"
        description="4대 AI(ChatGPT·Gemini·Claude·Perplexity)가 답변에서 우리 브랜드를 얼마나 인용하는지 측정합니다. 키워드 1개당 3변형(정보·비교·질문형) × 4 AI로 질의하고, 언급률·AI별 성적·경쟁사 점유·인용 문맥을 산출합니다."
      />

      {/* 데이터 연결 상태 — 연결된 엔진이 있으면 실측, 없으면 데모(정직 표기) */}
      {live ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
          <TierBadge tier="measured" note="실측 연결됨" />
          <span>연결된 AI 엔진으로 <b>실제 인용을 측정</b>합니다. 미연결 엔진은 자동으로 제외됩니다. <a href="/integrations" className="font-semibold underline">연결 상태 →</a></span>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
          <div className="flex flex-wrap items-center gap-2">
            <ConnectionBadge state="demo" hint="4-AI 실측 미연결" />
            <span>아래 수치는 <b>데모(시뮬레이션)</b>입니다. 실제 AI 인용 측정은 <a href="/geo" className="font-semibold underline">GEO 모니터링</a>(실 엔진 연동)에서 확인하세요.</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-amber-200 pt-2 text-xs">
            <span className="text-amber-700">실측 연결(하나만 있어도 켜짐):</span>
            <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] text-amber-900">OPENAI_API_KEY</code>
            <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] text-amber-900">PERPLEXITY_API_KEY</code>
            <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] text-amber-900">GOOGLE_AI_API_KEY</code>
            <a href="/integrations" className="ml-1 font-semibold text-amber-900 underline">연결 상태 →</a>
          </div>
        </div>
      )}

      {/* 입력 폼(GET) */}
      <form method="get" className="rounded-2xl border border-line bg-card p-4">
        <p className="mb-3 text-sm font-bold text-ink">스캔 입력</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block text-xs font-medium text-slate-600">브랜드
            <input name="brand" defaultValue={brand || "베놈한의원"} className={input} />
          </label>
          <label className="block text-xs font-medium text-slate-600">키워드 (쉼표)
            <input name="keywords" defaultValue={keywordsStr || "강남 한의원, 다이어트 한약"} className={input} />
          </label>
          <label className="block text-xs font-medium text-slate-600">경쟁사 (쉼표)
            <input name="competitors" defaultValue={competitorsStr || "서울메디컬"} className={input} />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            🛰️ 스캔 실행
          </button>
          <span className="text-[11px] text-slate-400">키워드 × 3변형 × 4 AI 질의 → 언급 감지·집계 {live ? "(실측 — 연결된 엔진 호출)" : "(데모 — 엔진 미연결)"}</span>
        </div>
      </form>

      {report && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "종합 언급률", value: `${report.overall_mention_rate}%` },
              { label: "총 질의 수", value: report.total_queries },
              { label: "측정 AI", value: Object.keys(report.by_ai).length },
              { label: "경쟁사", value: report.competitors.length }
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-line bg-card p-4">
                <p className="text-[11px] text-slate-500">{c.label}</p>
                <p className="text-xl font-bold text-ink">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="overflow-x-auto rounded-2xl border border-line bg-card">
              <p className="px-4 pt-4 text-sm font-bold text-ink">AI별 언급률</p>
              <table className="mt-2 w-full min-w-[420px] border-collapse text-left text-sm">
                <thead className="border-y border-line bg-surface text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-2">AI</th>
                    <th className="px-2 py-2">언급률</th>
                    <th className="px-2 py-2">언급/유효</th>
                    <th className="px-2 py-2">평균응답</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.by_ai).map(([p, a]) => (
                    <tr key={p} className="border-t border-line">
                      <td className="px-4 py-2 font-medium text-ink">
                        {AI_LABEL[p] ?? p}
                        {a.mocked && <span className="ml-1.5 rounded bg-surface px-1 py-0.5 text-[9px] text-slate-400">목</span>}
                      </td>
                      <td className={`px-2 py-2 font-semibold ${rateColor(a.rate)}`}>{a.rate}%</td>
                      <td className="px-2 py-2 text-slate-600">{a.mentioned}/{a.total}{a.errors ? ` (오류 ${a.errors})` : ""}</td>
                      <td className="px-2 py-2 text-slate-400">{a.avg_response_ms}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-line bg-card p-4">
              <p className="mb-3 text-sm font-bold text-ink">키워드별 언급률</p>
              <div className="space-y-2">
                {Object.entries(report.by_keyword).map(([kw, pct]) => (
                  <div key={kw}>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{kw}</span>
                      <span className={rateColor(pct)}>{pct}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-surface">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {report.competitors.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-line bg-card">
              <p className="px-4 pt-4 text-sm font-bold text-ink">경쟁사 인용 점유 (동일 응답 재사용 — 추가 비용 없음)</p>
              <table className="mt-2 w-full min-w-[520px] border-collapse text-left text-sm">
                <thead className="border-y border-line bg-surface text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-2">경쟁사</th>
                    <th className="px-2 py-2">종합</th>
                    {Object.keys(report.by_ai).map((p) => (
                      <th key={p} className="px-2 py-2">{AI_LABEL[p] ?? p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-line bg-emerald-50/40">
                    <td className="px-4 py-2 font-semibold text-emerald-800">{report.brand} (자사)</td>
                    <td className={`px-2 py-2 font-semibold ${rateColor(report.overall_mention_rate)}`}>{report.overall_mention_rate}%</td>
                    {Object.entries(report.by_ai).map(([p, a]) => (
                      <td key={p} className="px-2 py-2 text-slate-600">{a.rate}%</td>
                    ))}
                  </tr>
                  {report.competitors.map((c) => (
                    <tr key={c.name} className="border-t border-line">
                      <td className="px-4 py-2 font-medium text-ink">{c.name}</td>
                      <td className="px-2 py-2 font-semibold text-slate-600">{c.overall_rate}%</td>
                      {Object.keys(report.by_ai).map((p) => (
                        <td key={p} className="px-2 py-2 text-slate-400">{c.by_ai[p] ?? 0}%</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {contexts.length > 0 && (
            <details className="rounded-2xl border border-line bg-card p-4">
              <summary className="cursor-pointer text-sm font-bold text-ink">인용 문맥 ({contexts.length}건) — AI가 브랜드를 언급한 문장</summary>
              <ul className="mt-3 space-y-2">
                {contexts.slice(0, 20).map((ctx, i) => (
                  <li key={i} className="rounded-xl border border-line bg-surface p-3 text-[12px] leading-relaxed text-slate-700">{ctx}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
