import Link from "next/link";
import type { Route } from "next";
import { Activity, BarChart3, Eye, Search, TrendingUp, Users } from "lucide-react";
import type { ChannelSeries, ClientInsight, InsightClient, RankSeries } from "@/server/repositories/insights";

// 거래처 마케팅 인사이트 화면 — 병원 선택 탭 + 채널 방문자/노출 추이 + 검색 순위 추적 + 키워드.
// 모든 차트는 서버 렌더 SVG(클라이언트 JS 없음). 그래프 끝은 R값 없이(직선 캡).

const won = new Intl.NumberFormat("ko-KR");

const CHANNEL_LABEL: Record<string, string> = { place: "플레이스", blog: "블로그", homepage: "홈페이지", powerlink: "파워링크", seo: "SEO", geo: "GEO", aeo: "AEO" };

// 채널별 고정 색상(멀티컬러 + 오렌지 포인트).
const CHANNEL_COLOR: Record<string, string> = { place: "#d9662e", blog: "#3b6fe0", homepage: "#10b981" };
const RANK_COLORS = ["#d9662e", "#3b6fe0", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444"];

function shortDate(iso: string): string {
  return `${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))}`;
}

// 검색 트렌드 지수(네이버 데이터랩, 0~100 상대값) — 미니 게이지 바 + 지수. 미연결 시 "-".
function TrendCell({ ratio }: { ratio: number | null }) {
  if (ratio == null) return <span className="text-slate-300">–</span>;
  const pct = Math.max(0, Math.min(100, ratio));
  const tone = pct >= 66 ? "bg-emerald-500" : pct >= 33 ? "bg-amber-500" : "bg-slate-400";
  return (
    <span className="inline-flex items-center justify-end gap-1.5" title={`데이터랩 검색 트렌드 지수 ${pct} / 100 (기간 내 최고=100)`}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-line/70">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <b className="tabular-nums text-slate-600">{pct}</b>
    </span>
  );
}

/** 여러 채널 시계열을 하나의 축에 그리는 라인 차트. 값이 없으면 null 반환(빈 상태 처리는 호출부). */
function MultiLineChart({ series, unit }: { series: ChannelSeries[]; unit: string }) {
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  if (dates.length === 0) return null;
  const xIndex = new Map(dates.map((d, i) => [d, i]));
  const maxVal = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.value)));
  const W = 760;
  const H = 220;
  const padX = 8;
  const padTop = 12;
  const padBottom = 22;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const stepX = dates.length > 1 ? innerW / (dates.length - 1) : 0;
  const x = (date: string) => padX + (xIndex.get(date) ?? 0) * stepX;
  const y = (v: number) => padTop + innerH - (v / maxVal) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img">
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={padX} x2={W - padX} y1={padTop + innerH * f} y2={padTop + innerH * f} stroke="currentColor" className="text-line" strokeWidth={1} />
      ))}
      {series.map((s) => {
        const pts = s.points.map((p) => `${x(p.date)},${y(p.value)}`).join(" ");
        return (
          <polyline
            key={s.channel}
            points={pts}
            fill="none"
            stroke={CHANNEL_COLOR[s.channel] ?? "#94a3b8"}
            strokeWidth={2.5}
            strokeLinejoin="miter"
            strokeLinecap="butt"
          />
        );
      })}
      {dates.length > 1
        ? [dates[0], dates[Math.floor(dates.length / 2)], dates[dates.length - 1]].map((d) => (
            <text key={d} x={x(d)} y={H - 6} textAnchor="middle" className="fill-slate-400 text-[10px]">
              {shortDate(d)}
            </text>
          ))
        : null}
      <text x={padX} y={padTop + 4} className="fill-slate-300 text-[10px]">
        {won.format(maxVal)}
        {unit}
      </text>
    </svg>
  );
}

/** 채널별 최신 노출수 가로 막대. 막대 끝 R값 없음(직각). */
function ImpressionBars({ series }: { series: ChannelSeries[] }) {
  const max = Math.max(1, ...series.map((s) => s.latest));
  return (
    <ul className="space-y-3">
      {series.map((s) => (
        <li key={s.channel}>
          <div className="mb-1 flex items-center justify-between text-[12px]">
            <span className="font-semibold text-ink">{s.label}</span>
            <span className="tabular-nums text-slate-500">{won.format(s.latest)}</span>
          </div>
          <div className="h-2.5 w-full bg-surface">
            <div className="h-full" style={{ width: `${(s.latest / max) * 100}%`, background: CHANNEL_COLOR[s.channel] ?? "#94a3b8" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 검색 순위 추적 — 키워드별 순위(낮을수록 좋음, y축 반전). 끝점 원 없음. */
function RankChart({ series }: { series: RankSeries[] }) {
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  if (dates.length === 0) return null;
  const xIndex = new Map(dates.map((d, i) => [d, i]));
  const maxRank = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.rank)));
  const W = 760;
  const H = 220;
  const padX = 8;
  const padTop = 12;
  const padBottom = 22;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const stepX = dates.length > 1 ? innerW / (dates.length - 1) : 0;
  const x = (date: string) => padX + (xIndex.get(date) ?? 0) * stepX;
  const y = (rank: number) => padTop + ((rank - 1) / Math.max(1, maxRank - 1)) * innerH; // 1위=위쪽

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img">
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={padX} x2={W - padX} y1={padTop + innerH * f} y2={padTop + innerH * f} stroke="currentColor" className="text-line" strokeWidth={1} />
      ))}
      {series.map((s, i) => {
        const pts = s.points.map((p) => `${x(p.date)},${y(p.rank)}`).join(" ");
        return <polyline key={s.keyword} points={pts} fill="none" stroke={RANK_COLORS[i % RANK_COLORS.length]} strokeWidth={2.5} strokeLinejoin="miter" strokeLinecap="butt" />;
      })}
      {dates.length > 1
        ? [dates[0], dates[Math.floor(dates.length / 2)], dates[dates.length - 1]].map((d) => (
            <text key={d} x={x(d)} y={H - 6} textAnchor="middle" className="fill-slate-400 text-[10px]">
              {shortDate(d)}
            </text>
          ))
        : null}
      <text x={padX} y={padTop + 4} className="fill-slate-300 text-[10px]">1위</text>
    </svg>
  );
}

function EmptyChart({ note }: { note: string }) {
  return (
    <div className="flex h-[180px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-surface/40 text-center">
      <p className="text-sm font-semibold text-slate-400">데이터 수집 대기</p>
      <p className="text-[11.5px] text-slate-400">{note}</p>
    </div>
  );
}

type Kpi = { label: string; value: string; sub: string; icon: typeof Users; tone: string };

export function InsightsView({
  clients,
  selectedId,
  insight
}: {
  clients: InsightClient[];
  selectedId: string | null;
  insight: ClientInsight | null;
}) {
  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface/40 px-6 py-16 text-center">
        <p className="text-sm font-semibold text-slate-500">담당 거래처가 없습니다</p>
        <p className="mt-1 text-[12.5px] text-slate-400">거래처가 배정되면 채널별 마케팅 인사이트가 여기에 표시됩니다.</p>
      </div>
    );
  }

  const kpis: Kpi[] = insight
    ? [
        { label: "플레이스 방문자", value: won.format(insight.kpis.placeVisitors), sub: "최근 일자", icon: Users, tone: "bg-brand-soft text-brand-strong" },
        { label: "블로그 방문자", value: won.format(insight.kpis.blogVisitors), sub: "최근 일자", icon: Activity, tone: "bg-blue-50 text-blue-600" },
        { label: "홈페이지 방문자", value: won.format(insight.kpis.homepageVisitors), sub: "최근 일자", icon: TrendingUp, tone: "bg-emerald-50 text-emerald-600" },
        { label: "총 검색 노출", value: won.format(insight.kpis.totalImpressions), sub: "채널 합계", icon: Eye, tone: "bg-violet-50 text-violet-600" },
        { label: "추적 키워드", value: String(insight.kpis.trackedKeywords), sub: "순위 추적 중", icon: Search, tone: "bg-amber-50 text-amber-600" }
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* 병원 선택 탭 */}
      <div className="flex flex-wrap gap-2">
        {clients.map((c) => {
          const active = c.id === selectedId;
          return (
            <Link
              key={c.id}
              href={`/insights?client=${c.id}` as Route}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
                active ? "border-brand bg-brand text-white" : "border-line bg-white text-slate-600 hover:border-brand/40"
              }`}
            >
              {c.name}
            </Link>
          );
        })}
      </div>

      {!insight ? (
        <div className="rounded-2xl border border-line bg-white px-6 py-16 text-center text-sm text-slate-400">거래처를 선택하세요.</div>
      ) : (
        <>
          {/* 채널 요약 KPI */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-2xl border border-line bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-slate-500">{k.label}</span>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${k.tone}`}>
                    <k.icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="text-xl font-extrabold tabular-nums text-ink">{k.value}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{k.sub}</p>
              </div>
            ))}
          </section>

          {/* 채널별 방문자 추이 + 노출 현황 */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-line bg-white p-5 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-bold text-ink"><Activity className="h-4 w-4 text-brand" /> 채널별 일별 방문자 추이</p>
                <span className="text-[11px] text-slate-400">최근 {insight.rangeDays}일</span>
              </div>
              {insight.hasChannelData && insight.visitorSeries.length > 0 ? (
                <>
                  <MultiLineChart series={insight.visitorSeries} unit="" />
                  <div className="mt-3 flex flex-wrap gap-3">
                    {insight.visitorSeries.map((s) => (
                      <span key={s.channel} className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CHANNEL_COLOR[s.channel] ?? "#94a3b8" }} />
                        {s.label} <b className="tabular-nums text-ink">{won.format(s.latest)}</b>
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyChart note="채널 방문자 지표가 수집되면 일별 추이가 표시됩니다." />
              )}
            </div>
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink"><BarChart3 className="h-4 w-4 text-violet-500" /> 채널별 검색 노출</p>
              {insight.hasChannelData && insight.impressionSeries.length > 0 ? (
                <ImpressionBars series={insight.impressionSeries} />
              ) : (
                <EmptyChart note="노출 지표 수집 대기" />
              )}
            </div>
          </section>

          {/* 검색 순위 추적 */}
          <section className="rounded-2xl border border-line bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-sm font-bold text-ink"><TrendingUp className="h-4 w-4 text-blue-500" /> 검색 순위 추적</p>
              <span className="text-[11px] text-slate-400">낮을수록 상위</span>
            </div>
            {insight.hasRankData && insight.rankSeries.length > 0 ? (
              <>
                <RankChart series={insight.rankSeries} />
                <div className="mt-3 flex flex-wrap gap-3">
                  {insight.rankSeries.map((s, i) => (
                    <span key={s.keyword} className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: RANK_COLORS[i % RANK_COLORS.length] }} />
                      {s.keyword} <b className="tabular-nums text-ink">{s.latest != null ? `${s.latest}위` : "-"}</b>
                      {s.delta ? <span className={s.delta > 0 ? "text-emerald-600" : "text-rose-500"}>{s.delta > 0 ? `▲${s.delta}` : `▼${Math.abs(s.delta)}`}</span> : null}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <EmptyChart note="플레이스/블로그 순위 기록이 쌓이면 시계열이 표시됩니다." />
            )}
          </section>

          {/* 핵심 키워드 표 + 연관 키워드 */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink"><Search className="h-4 w-4 text-amber-500" /> 핵심 키워드 성과</p>
              {insight.coreKeywords.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[360px] text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="pb-2 pr-3 text-left font-semibold">키워드</th>
                        <th className="px-2 pb-2 text-left font-semibold">채널</th>
                        <th className="px-2 pb-2 text-right font-semibold">월 검색량</th>
                        <th className="pb-2 pl-2 text-right font-semibold">검색 트렌드</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insight.coreKeywords.map((k) => (
                        <tr key={k.id} className="border-t border-line">
                          <td className="py-2.5 pr-3 font-semibold text-ink">{k.keyword}</td>
                          <td className="px-2 py-2.5 text-slate-500">{CHANNEL_LABEL[k.channel] ?? k.channel}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">{k.searchVolume != null ? won.format(k.searchVolume) : "-"}</td>
                          <td className="py-2.5 pl-2 text-right"><TrendCell ratio={k.trendRatio} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-400">월 검색량 = 네이버 검색광고 <b className="text-slate-500">절대 조회수</b> · 검색 트렌드 = 데이터랩 <b className="text-slate-500">상대 지수(0~100)</b>. 서로 다른 척도입니다.</p>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-8 text-center text-sm text-slate-400">등록된 핵심 키워드가 없습니다.</p>
              )}
            </div>
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-ink">연관 키워드 제안</p>
                <Link href={"/keywords" as Route} className="text-xs font-bold text-brand-strong">검색량 조회 →</Link>
              </div>
              {insight.relatedKeywords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {insight.relatedKeywords.map((k) => (
                    <span key={k.id} className="rounded-full border border-line bg-surface/60 px-3 py-1 text-[12px] text-slate-600">
                      {k.keyword}
                      {k.searchVolume != null ? <b className="ml-1 text-brand-strong">{won.format(k.searchVolume)}</b> : null}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-8 text-center text-sm text-slate-400">연관 키워드가 없습니다.</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
