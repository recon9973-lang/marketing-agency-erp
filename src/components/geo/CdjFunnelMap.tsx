// GEO 전략 지도 — 고객여정(CDJ) 6단계 퍼널맵. 리스닝마인드형 프레임워크에 우리 실측 KPI를 부착.
// 순수 SVG/CSS 자체 렌더(외부 라이브러리 없음 · PWA/CSP 안전). 프레임워크는 전략 템플릿,
// KPI 타일만 실측(정직성). 참고: 초기탐색→정보탐색→경험탐색→구매확정→구매후→리텐션.

export type CdjMetrics = {
  keywords?: number;
  questions?: number;
  mentionRate?: number; // %
  citedCount?: number;
  publishedPages?: number;
};

type Stage = {
  step: number;
  ko: string;
  en: string;
  state: string; // 소비자 상태
  owned: string[]; // 우리 오운드미디어 액션
  kpi?: { label: string; value: string };
  width: number; // 퍼널 폭(관심 모수 축소 표현) 0~100
};

export function CdjFunnelMap({ metrics, clientName }: { metrics: CdjMetrics; clientName: string }) {
  const pct = (n?: number) => (n == null ? "—" : `${n}%`);
  const num = (n?: number) => (n == null ? "—" : n.toLocaleString("ko-KR"));

  const stages: Stage[] = [
    {
      step: 1,
      ko: "초기 탐색",
      en: "Initial Exploration",
      state: "문제·욕구 발생, 넌브랜드 검색 시작",
      owned: ["보도자료", "블로그", "정보성 콘텐츠"],
      kpi: { label: "채택 키워드", value: num(metrics.keywords) },
      width: 100
    },
    {
      step: 2,
      ko: "정보 탐색",
      en: "Browsing",
      state: "브랜드·제품 정보, 스펙·비교 탐색",
      owned: ["카테고리 페이지", "질문 답변형 글", "FAQ"],
      kpi: { label: "측정 질문", value: num(metrics.questions) },
      width: 82
    },
    {
      step: 3,
      ko: "경험 탐색",
      en: "Experience",
      state: "리뷰·후기·체험 정보 확인",
      owned: ["고객 리뷰", "미디어 리뷰", "사례 콘텐츠"],
      kpi: { label: "게시 답변 페이지", value: num(metrics.publishedPages) },
      width: 64
    },
    {
      step: 4,
      ko: "구매 확정",
      en: "Confirmation",
      state: "가격·혜택 비교 후 결정(Point of Purchase)",
      owned: ["구매 가이드", "이벤트/프로모션", "상세페이지"],
      kpi: { label: "AI 인용 질문", value: num(metrics.citedCount) },
      width: 46
    },
    {
      step: 5,
      ko: "구매 후",
      en: "Own",
      state: "활용법·이슈 해결 정보 탐색",
      owned: ["활용 가이드", "문제 해결 콘텐츠"],
      kpi: { label: "AI 언급률", value: pct(metrics.mentionRate) },
      width: 58
    },
    {
      step: 6,
      ko: "리텐션",
      en: "Retention",
      state: "재구매·추천·커뮤니티 참여",
      owned: ["커뮤니티", "재구매 유도", "크로스셀"],
      width: 70
    }
  ];

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-ink">GEO 전략 지도 · 고객여정(CDJ) 6단계</h3>
        <span className="rounded-md border border-slate-200 bg-surface px-2 py-0.5 text-[10px] font-bold text-slate-500">전략 프레임워크</span>
        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">KPI 실측</span>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        {clientName ? <b className="text-slate-600">{clientName}</b> : "거래처"}의 소비자 구매여정 6단계별 오운드미디어 전략과 현재 GEO 성과.
      </p>

      {/* 퍼널 밴드 (관심 모수 축소 → 구매 확정 → 리텐션) */}
      <div className="mb-3 flex items-end gap-1">
        {stages.map((s) => (
          <div key={s.step} className="flex-1">
            <div className="mx-auto rounded-t bg-gradient-to-b from-emerald-500 to-emerald-600" style={{ height: 8, width: `${s.width}%` }} />
          </div>
        ))}
      </div>

      {/* 6단계 카드 */}
      <div className="overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-6 gap-2">
          {stages.map((s) => (
            <div key={s.step} className="rounded-xl border border-line bg-surface/40 p-3">
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">{s.step}</span>
                <p className="text-xs font-bold text-ink">{s.ko}</p>
              </div>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wide text-slate-400">{s.en}</p>
              <p className="mt-2 text-[11px] leading-snug text-slate-600">{s.state}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {s.owned.map((o) => (
                  <span key={o} className="rounded bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-500 ring-1 ring-line">
                    {o}
                  </span>
                ))}
              </div>
              {s.kpi && (
                <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                  <p className="text-sm font-bold leading-none text-emerald-700">{s.kpi.value}</p>
                  <p className="mt-0.5 text-[9px] text-emerald-600">{s.kpi.label}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
