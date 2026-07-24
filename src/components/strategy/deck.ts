// 마케팅 전략 PPT 생성 — pptxgenjs를 브라우저에서 동적 로드해 즉시 다운로드.
// 8개 실측 블록 → VENOM 제안 덱 구조 슬라이드. (색상 6-hex·# 금지, Malgun Gothic)
import type { MarketingStrategy } from "@/server/actions/strategy";

const C = {
  brand: "F97316", ink: "1E293B", sub: "64748B", light: "FFF7ED", line: "E2E8F0",
  ok: "059669", warn: "D97706", risk: "E11D48", white: "FFFFFF", dark: "0F172A", gray: "CBD5E1"
};
const FONT = "Malgun Gothic";
const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("ko-KR"));
const won = (w: number) => `${Math.round(w / 10000).toLocaleString("ko-KR")}만`;
const SIG: Record<string, string> = { good: C.ok, watch: C.warn, risk: C.risk, nodata: C.gray };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Slide = any;

export async function downloadStrategyDeck(strategy: MarketingStrategy, today: string): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pptx.defineSlideMaster({ title: "M", background: { color: C.white } });

  const s = strategy;
  const label = `${s.regionLabel}${s.specialty ? ` · ${s.specialty}` : ""}`;

  const head = (sl: Slide, t: string, no: number) => {
    sl.addText(t, { x: 0.6, y: 0.35, w: 11, h: 0.6, fontSize: 24, bold: true, color: C.ink, fontFace: FONT });
    sl.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.02, w: 1.2, h: 0.06, fill: { color: C.brand } });
    sl.addText(`${no}`, { x: 12.4, y: 0.35, w: 0.5, h: 0.5, fontSize: 14, color: C.sub, align: "right", fontFace: FONT });
    sl.addText("VENOM · 실측 기반 · 의료광고법 준수", { x: 8.5, y: 6.98, w: 4.3, h: 0.32, fontSize: 9, color: C.sub, align: "right", fontFace: FONT });
  };
  const bar = (sl: Slide, x: number, y: number, wMax: number, ratio: number, color: string) =>
    sl.addShape(pptx.ShapeType.rect, { x, y, w: Math.max(0.04, wMax * Math.min(1, Math.max(0, ratio))), h: 0.24, fill: { color } });
  const tbl = (sl: Slide, rows: string[][], x: number, y: number, w: number, colW: number[]) =>
    sl.addTable(
      rows.map((r, ri) =>
        r.map((c) => ({
          text: c,
          options: { fontSize: 11, fontFace: FONT, color: ri === 0 ? C.white : C.ink, fill: { color: ri === 0 ? C.brand : ri % 2 ? C.white : C.light }, align: "left", valign: "middle" }
        }))
      ),
      { x, y, w, colW, border: { type: "solid", pt: 0.5, color: C.line }, rowH: 0.34 }
    );

  // ── 1. 표지 ───────────────────────────────────────────────
  const s1 = pptx.addSlide();
  s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: C.dark } });
  s1.addShape(pptx.ShapeType.rect, { x: 0.8, y: 3.0, w: 0.16, h: 1.5, fill: { color: C.brand } });
  s1.addText("VENOM & MARKEPICK", { x: 0.8, y: 1.0, w: 11, h: 0.5, fontSize: 16, bold: true, color: C.brand, fontFace: FONT, charSpacing: 2 });
  s1.addText(`${s.brand}`, { x: 1.15, y: 2.9, w: 11, h: 0.7, fontSize: 26, color: C.gray, fontFace: FONT });
  s1.addText("마케팅 전략 제안", { x: 1.15, y: 3.6, w: 11, h: 1.0, fontSize: 44, bold: true, color: C.white, fontFace: FONT });
  s1.addText(`${label} · ${today}`, { x: 1.15, y: 4.8, w: 11, h: 0.5, fontSize: 16, color: C.gray, fontFace: FONT });
  s1.addText("상권·키워드·검색여정·정밀진단·경쟁·예산·채널점유 실측 종합", { x: 1.15, y: 6.6, w: 11, h: 0.4, fontSize: 11, color: C.sub, fontFace: FONT });

  // ── 2. 핵심 요약(KPI 카드) — 상권분석 덱과 동일 구조 ───────
  const sSum = pptx.addSlide();
  head(sSum, "핵심 요약", 2);
  const a0 = s.acquisition?.review;
  const kpis: [string, string][] = [
    [a0 ? `${a0.overallScore}` : "—", a0 ? `수주 진단 (${a0.stage})` : "수주 진단"],
    [`${s.keywords.rows.length}`, `실측 키워드${s.keywords.searchConnected ? "" : "(데모)"}`],
    [`${s.competitors.places.length}`, "경쟁사 표본(최대 5)"],
    [s.seo.ok ? `${s.seo.score}` : "—", s.seo.ok ? `SEO·GEO (${s.seo.grade})` : "SEO·GEO 진단"]
  ];
  kpis.forEach(([v, k], i) => {
    const x = 0.6 + i * 3.05;
    sSum.addShape(pptx.ShapeType.roundRect, { x, y: 1.6, w: 2.8, h: 1.7, fill: { color: C.light }, line: { color: C.line, width: 1 }, rectRadius: 0.06 });
    sSum.addText(v, { x, y: 1.9, w: 2.8, h: 0.8, fontSize: 32, bold: true, color: C.brand, align: "center", fontFace: FONT });
    sSum.addText(k, { x, y: 2.75, w: 2.8, h: 0.5, fontSize: 11.5, color: C.sub, align: "center", fontFace: FONT });
  });
  // 채널 점유 요약(있으면) + 예산 한줄
  const sovLine = s.sov.configured
    ? `채널 점유: ${s.sov.channels.map((c) => `${c.channel} ${c.ownSlots > 0 ? (c.ownRank ? `${c.ownRank}위` : `상위 ${c.ownSlots}건`) : "미노출"}`).join(" · ")}`
    : "채널 점유: 병원명 입력 시 본원 노출 실측";
  sSum.addText(sovLine, { x: 0.6, y: 3.8, w: 12.1, h: 0.5, fontSize: 13, color: C.ink, fontFace: FONT });
  const budgetLine = s.budget.bidConnected
    ? `광고 예산(실측 CPC): ${s.budget.scenarios.map((sc) => `${sc.label} ${won(sc.monthlyWon)}원`).join(" · ")}`
    : "광고 예산: 네이버 검색광고 연결 시 실측 CPC 기반 산출(추정 없음)";
  sSum.addText(budgetLine, { x: 0.6, y: 4.4, w: 12.1, h: 0.5, fontSize: 13, color: C.ink, fontFace: FONT });
  if (a0?.headline) sSum.addText(`· ${a0.headline}`, { x: 0.6, y: 5.1, w: 12.1, h: 0.8, fontSize: 12, color: C.sub, fontFace: FONT, lineSpacingMultiple: 1.1 });

  // ── 3. 수주 진단 ──────────────────────────────────────────
  const a = s.acquisition?.review;
  if (a) {
    const s2 = pptx.addSlide();
    head(s2, "01. 수주 진단 · 대응 방향", 3);
    s2.addText(a.stage, { x: 0.6, y: 1.35, w: 6, h: 0.5, fontSize: 20, bold: true, color: C.brand, fontFace: FONT });
    s2.addText(`${a.overallScore}/100`, { x: 10.5, y: 1.3, w: 2.3, h: 0.6, fontSize: 28, bold: true, color: C.ink, align: "right", fontFace: FONT });
    s2.addText(a.headline, { x: 0.6, y: 1.9, w: 12.1, h: 0.6, fontSize: 12, color: C.sub, fontFace: FONT });
    a.areas.slice(0, 6).forEach((ar, i) => {
      const y = 2.7 + i * 0.5;
      s2.addShape(pptx.ShapeType.ellipse, { x: 0.65, y: y + 0.05, w: 0.16, h: 0.16, fill: { color: SIG[ar.status] ?? C.gray } });
      s2.addText(ar.label, { x: 0.95, y, w: 2.6, h: 0.3, fontSize: 11, bold: true, color: C.ink, fontFace: FONT });
      s2.addText(ar.signal, { x: 3.6, y, w: 6.2, h: 0.35, fontSize: 10, color: C.sub, fontFace: FONT });
      s2.addText(ar.metric ?? "", { x: 9.9, y, w: 2.9, h: 0.3, fontSize: 10, color: C.ink, align: "right", fontFace: FONT });
    });
    if (a.actions.length) {
      s2.addText("대응 방향", { x: 0.6, y: 5.85, w: 3, h: 0.3, fontSize: 12, bold: true, color: C.brand, fontFace: FONT });
      s2.addText(a.actions.slice(0, 3).map((x, i) => `${i + 1}. ${x.title} — ${x.how}`).join("\n"), { x: 0.6, y: 6.15, w: 12.1, h: 0.8, fontSize: 10, color: C.ink, fontFace: FONT, lineSpacingMultiple: 1.1 });
    }
  }

  // ── 3. 키워드 실측 ────────────────────────────────────────
  const s3 = pptx.addSlide();
  head(s3, "02. 키워드 실측 · 검색량·경쟁·포화도", 4);
  if (s.keywords.rows.length) {
    const rows = [["키워드", "합계", "경쟁", "블로그", "포화도"]].concat(
      s.keywords.rows.slice(0, 11).map((r) => [r.keyword, fmt(r.total), r.competition ?? "—", fmt(r.blogDocs), r.saturation ?? "—"])
    );
    tbl(s3, rows, 0.6, 1.35, 7.0, [2.6, 1.2, 1.0, 1.1, 1.1]);
    // 그래프: 상위 월검색량 가로 막대(인포그래픽)
    const topV = s.keywords.rows.filter((r) => (r.total ?? 0) > 0).slice(0, 7);
    if (topV.length) {
      s3.addText("월검색량 상위", { x: 8.0, y: 1.35, w: 4.7, h: 0.35, fontSize: 12, bold: true, color: C.ink, fontFace: FONT });
      s3.addChart(pptx.ChartType.bar, [{ name: "월검색량", labels: topV.map((r) => r.keyword), values: topV.map((r) => r.total ?? 0) }], {
        x: 8.0, y: 1.75, w: 4.8, h: 4.8, barDir: "bar", chartColors: [C.brand], showLegend: false, showValue: true,
        dataLabelColor: C.ink, dataLabelFontSize: 9, dataLabelFontFace: FONT, catAxisLabelColor: C.ink, catAxisLabelFontFace: FONT,
        catAxisLabelFontSize: 9, valAxisHidden: true, valGridLine: { style: "none" }, catAxisLineShow: false
      });
    }
  } else s3.addText("키워드 결과 없음(진료과 선택 시 정확도 상승).", { x: 0.6, y: 1.5, w: 12, h: 0.4, fontSize: 12, color: C.sub, fontFace: FONT });
  s3.addText(`검색량·경쟁: 네이버 검색광고${s.keywords.searchConnected ? "(실측)" : "(미연동·데모)"} · 포화도: 네이버 블로그`, { x: 0.6, y: 6.9, w: 12, h: 0.35, fontSize: 9, color: C.sub, fontFace: FONT });

  // ── 4. 검색 여정·퍼널 ─────────────────────────────────────
  const s4 = pptx.addSlide();
  head(s4, "03. 검색 여정 · 퍼널 전략", 5);
  const stages = ["문제인식", "정보탐색", "비교", "병원검토", "예약"] as const;
  stages.forEach((st, i) => {
    const ks = s.journey.keywords.filter((k) => k.stage === st).map((k) => k.keyword);
    if (!ks.length) return;
    const y = 1.4 + i * 0.42;
    s4.addText(st, { x: 0.6, y, w: 1.5, h: 0.3, fontSize: 11, bold: true, color: C.brand, fontFace: FONT });
    s4.addText(ks.join(", "), { x: 2.2, y, w: 10.5, h: 0.35, fontSize: 10, color: C.ink, fontFace: FONT });
  });
  s.journey.funnel.forEach((f, i) => {
    const x = 0.6 + i * 4.15;
    s4.addShape(pptx.ShapeType.roundRect, { x, y: 3.9, w: 3.9, h: 2.7, fill: { color: C.light }, line: { color: C.brand, width: 1 }, rectRadius: 0.08 });
    s4.addText(f.funnel, { x: x + 0.2, y: 4.05, w: 3.5, h: 0.4, fontSize: 15, bold: true, color: C.brand, fontFace: FONT });
    s4.addText(f.goal, { x: x + 0.2, y: 4.5, w: 3.5, h: 0.4, fontSize: 11, bold: true, color: C.ink, fontFace: FONT });
    s4.addText(f.message, { x: x + 0.2, y: 4.95, w: 3.5, h: 0.8, fontSize: 9.5, color: C.sub, fontFace: FONT });
    s4.addText(`채널: ${f.channels.join("·")}`, { x: x + 0.2, y: 5.75, w: 3.5, h: 0.3, fontSize: 9, color: C.sub, fontFace: FONT });
    s4.addText(`KPI: ${f.kpi} · 검색수 ${fmt(f.searchVolume)}`, { x: x + 0.2, y: 6.05, w: 3.5, h: 0.4, fontSize: 9, color: C.ink, fontFace: FONT });
  });

  // ── 5. 정밀진단(SEO·GEO) ──────────────────────────────────
  if (s.seo.attempted) {
    const s5 = pptx.addSlide();
    head(s5, "04. 홈페이지 검색·AI 노출 정밀진단", 6);
    if (s.seo.ok) {
      s5.addText(`${s.seo.score}`, { x: 0.6, y: 1.4, w: 2, h: 1.0, fontSize: 54, bold: true, color: C.brand, fontFace: FONT });
      s5.addText(`/100 · ${s.seo.grade}`, { x: 2.5, y: 2.0, w: 3, h: 0.5, fontSize: 16, color: C.sub, fontFace: FONT });
      s5.addText(`${s.seo.domain} · 엔진 ${s.seo.version}`, { x: 0.6, y: 2.5, w: 6, h: 0.3, fontSize: 10, color: C.sub, fontFace: FONT });
      s.seo.categories.slice(0, 6).forEach((c, i) => {
        const y = 1.5 + i * 0.55;
        s5.addText(c.label, { x: 6.4, y, w: 2.4, h: 0.3, fontSize: 10, color: C.ink, fontFace: FONT });
        bar(s5, 8.9, y + 0.02, 3.0, c.pct / 100, c.pct >= 75 ? C.ok : c.pct >= 50 ? C.warn : C.risk);
        s5.addText(`${c.pct}%`, { x: 12.0, y, w: 0.8, h: 0.3, fontSize: 10, color: C.ink, align: "right", fontFace: FONT });
      });
      if (s.seo.topFixes.length) {
        s5.addText("개선 우선순위", { x: 0.6, y: 3.9, w: 4, h: 0.3, fontSize: 12, bold: true, color: C.brand, fontFace: FONT });
        s5.addText(s.seo.topFixes.map((f) => `· ${f.name}: ${f.desc}`).join("\n"), { x: 0.6, y: 4.25, w: 12.1, h: 2.4, fontSize: 10, color: C.ink, fontFace: FONT, lineSpacingMultiple: 1.15 });
      }
    } else s5.addText(`진단 실패(${s.seo.error}) — URL·접근성 확인.`, { x: 0.6, y: 1.5, w: 12, h: 0.4, fontSize: 12, color: C.warn, fontFace: FONT });
  }

  // ── 6. 채널 점유 ──────────────────────────────────────────
  if (s.sov.configured) {
    const s6 = pptx.addSlide();
    head(s6, "05. 채널 점유 · 본원 vs 경쟁", 7);
    s6.addText(`핵심 키워드: ${s.sov.keyword ?? "—"}`, { x: 0.6, y: 1.35, w: 12, h: 0.4, fontSize: 12, color: C.sub, fontFace: FONT });
    s.sov.channels.forEach((c, i) => {
      const y = 2.3 + i * 1.0;
      const ownPct = c.topN > 0 ? c.ownSlots / c.topN : 0;
      s6.addText(c.channel, { x: 0.6, y, w: 2, h: 0.3, fontSize: 13, bold: true, color: C.ink, fontFace: FONT });
      s6.addText(c.ownSlots > 0 ? (c.ownRank ? `본원 ${c.ownRank}위 노출` : `본원 상위 ${c.ownSlots}건`) : "본원 미노출", { x: 8.5, y, w: 4.3, h: 0.3, fontSize: 11, color: c.ownSlots > 0 ? C.brand : C.sub, align: "right", fontFace: FONT });
      bar(s6, 0.6, y + 0.4, 12.1, ownPct, C.brand);
      s6.addShape(pptx.ShapeType.rect, { x: 0.6 + 12.1 * ownPct, y: y + 0.4, w: 12.1 * (1 - ownPct), h: 0.24, fill: { color: C.gray } });
    });
    s6.addText("■ 본원  ■ 경쟁 · 미노출 채널이 진입 우선순위(경쟁이 점유 중).", { x: 0.6, y: 6.5, w: 12, h: 0.4, fontSize: 10, color: C.sub, fontFace: FONT });
  }

  // ── 7. 경쟁사 ─────────────────────────────────────────────
  if (s.competitors.places.length) {
    const s7 = pptx.addSlide();
    head(s7, "06. 경쟁사 상위 표본", 8);
    s.competitors.places.slice(0, 5).forEach((p, i) => {
      const y = 1.5 + i * 1.0;
      s7.addText(`${i + 1}`, { x: 0.6, y, w: 0.6, h: 0.5, fontSize: 20, bold: true, color: C.brand, fontFace: FONT });
      s7.addText(p.name, { x: 1.3, y, w: 7, h: 0.4, fontSize: 15, bold: true, color: C.ink, fontFace: FONT });
      s7.addText(p.category, { x: 1.3, y: y + 0.42, w: 7, h: 0.3, fontSize: 10, color: C.sub, fontFace: FONT });
      s7.addText(p.roadAddress || p.address, { x: 8.3, y: y + 0.1, w: 4.5, h: 0.5, fontSize: 10, color: C.sub, align: "right", fontFace: FONT });
    });
    s7.addText("네이버 지역검색 상위 표본(최대 5). 정밀 순위·리뷰수는 플레이스 별도 확인.", { x: 0.6, y: 6.7, w: 12, h: 0.4, fontSize: 9, color: C.sub, fontFace: FONT });
  }

  // ── 8. 광고 예산 시나리오 ─────────────────────────────────
  const s8 = pptx.addSlide();
  head(s8, "07. 광고 예산 시나리오 · 파워링크", 9);
  if (s.budget.bidConnected) {
    const brows = [["키워드", "월검색수", "경쟁", "CPC(실측)"]].concat(
      s.budget.rows.map((r) => [r.keyword, fmt(r.total), r.competition ?? "—", r.cpc == null ? "미조회" : fmt(r.cpc)])
    );
    tbl(s8, brows, 0.6, 1.35, 6.6, [3.0, 1.6, 1.0, 1.0]);
    s.budget.scenarios.forEach((sc, i) => {
      const y = 1.5 + i * 1.6;
      s8.addShape(pptx.ShapeType.roundRect, { x: 7.6, y, w: 5.1, h: 1.35, fill: { color: C.light }, line: { color: C.brand, width: 1 }, rectRadius: 0.06 });
      s8.addText(sc.label, { x: 7.8, y: y + 0.12, w: 2, h: 0.3, fontSize: 12, bold: true, color: C.brand, fontFace: FONT });
      s8.addText(`${won(sc.monthlyWon)}원/월`, { x: 9.6, y: y + 0.1, w: 3, h: 0.5, fontSize: 20, bold: true, color: C.ink, align: "right", fontFace: FONT });
      s8.addText(sc.note, { x: 7.8, y: y + 0.75, w: 4.7, h: 0.4, fontSize: 9.5, color: C.sub, fontFace: FONT });
    });
    s8.addText(`CPC = 네이버 검색광고 실측 입찰가 · 예산 = 월검색량×CTR×CPC 가늠(실집행 전 참고)${s.budget.measuredCount < s.budget.rows.length ? ` · 실측 ${s.budget.measuredCount}개 키워드 기준` : ""}`, { x: 0.6, y: 6.9, w: 12, h: 0.35, fontSize: 9, color: C.sub, fontFace: FONT });
  } else {
    const brows = [["키워드", "월검색수", "경쟁"]].concat(
      s.budget.rows.map((r) => [r.keyword, fmt(r.total), r.competition ?? "—"])
    );
    tbl(s8, brows, 0.6, 1.35, 6.6, [3.6, 2.0, 1.0]);
    s8.addShape(pptx.ShapeType.roundRect, { x: 7.6, y: 1.5, w: 5.1, h: 3.2, fill: { color: C.light }, line: { color: C.warn, width: 1 }, rectRadius: 0.06 });
    s8.addText("예산 시나리오 미산출", { x: 7.85, y: 1.75, w: 4.6, h: 0.4, fontSize: 14, bold: true, color: C.warn, fontFace: FONT });
    s8.addText("네이버 검색광고 API 미연결로 CPC 실측 입찰가를 확보하지 못했습니다. 추정치는 사용하지 않습니다.", { x: 7.85, y: 2.3, w: 4.6, h: 1.4, fontSize: 11, color: C.ink, fontFace: FONT, lineSpacingMultiple: 1.15 });
    s8.addText("NAVER_AD_API_KEY·SECRET·CUSTOMER_ID 연결 시 실측 입찰가 기반 예산이 자동 산출됩니다.", { x: 7.85, y: 3.7, w: 4.6, h: 0.9, fontSize: 9.5, color: C.sub, fontFace: FONT, lineSpacingMultiple: 1.15 });
    s8.addText("CPC 추정 금지 원칙 — 실측 입찰가만 예산 근거로 사용합니다.", { x: 0.6, y: 6.9, w: 12, h: 0.35, fontSize: 9, color: C.sub, fontFace: FONT });
  }

  // ── 9. 의료광고 리스크 ────────────────────────────────────
  const s9 = pptx.addSlide();
  head(s9, "08. 의료광고 리스크 · 의료법 §56 1차 스캔", 10);
  if (!s.compliance.scanned) s9.addText("홈페이지 URL 미입력 — 있으면 위험 표현 자동 점검.", { x: 0.6, y: 1.5, w: 12, h: 0.4, fontSize: 12, color: C.sub, fontFace: FONT });
  else if (s.compliance.high + s.compliance.medium === 0) s9.addText("위험 표현 미검출(자동 1차). 최종 게시 전 내부·전문 검토 유지.", { x: 0.6, y: 1.5, w: 12, h: 0.4, fontSize: 13, color: C.ok, fontFace: FONT });
  else {
    s9.addText(`높음 ${s.compliance.high}`, { x: 0.6, y: 1.4, w: 2.5, h: 0.5, fontSize: 18, bold: true, color: C.risk, fontFace: FONT });
    s9.addText(`중간 ${s.compliance.medium}`, { x: 3.2, y: 1.4, w: 2.5, h: 0.5, fontSize: 18, bold: true, color: C.warn, fontFace: FONT });
    s9.addText("계약·심의 전 수정 권고", { x: 6.0, y: 1.5, w: 5, h: 0.4, fontSize: 12, color: C.sub, fontFace: FONT });
    s9.addText(s.compliance.flags.slice(0, 12).map((f) => `[${f.severity === "high" ? "높음" : "중간"}] ${f.label}: "${f.matched}"`).join("\n"), { x: 0.6, y: 2.2, w: 12.1, h: 4.3, fontSize: 11, color: C.ink, fontFace: FONT, lineSpacingMultiple: 1.15 });
  }
  s9.addText("1차 자동 필터 — 심의 통과를 보장하지 않음(의료법 §56). 전후사진·최상급·효과보장 표현 지양.", { x: 0.6, y: 6.9, w: 12, h: 0.35, fontSize: 9, color: C.sub, fontFace: FONT });

  // ── 11. 데이터 출처 · 고지 — 상권분석 덱과 동일 표기 체계 ──
  const sSrc = pptx.addSlide();
  head(sSrc, "데이터 출처 · 고지", 11);
  const measured: string[] = [];
  const missing: string[] = [];
  (s.keywords.searchConnected ? measured : missing).push("키워드 검색량·경쟁(네이버 검색광고)");
  (s.budget.bidConnected ? measured : missing).push("파워링크 CPC 입찰가(네이버 검색광고)");
  (s.competitors.places.length ? measured : missing).push("경쟁사 상위 표본(네이버 지역검색·최대 5)");
  (s.keywords.rows.some((r) => r.blogDocs != null) ? measured : missing).push("블로그 포화도(네이버 블로그)");
  (s.seo.ok ? measured : missing).push("홈페이지 SEO·GEO 정밀진단(VENOM 엔진)");
  (s.compliance.scanned ? measured : missing).push("의료광고 위험 표현 스캔(홈페이지)");
  (s.sov.configured ? measured : missing).push("채널 점유율(본원 vs 경쟁)");
  const lines: [string, string][] = [
    ["✅ 실측", measured.length ? measured.join(", ") : "—"],
    ["🟡 정성", "수주 진단 단계·대응 방향·검색여정 퍼널 메시지(해석)"],
    ["🔴 미실측", missing.length ? missing.join(", ") : "없음(주요 소스 연결됨)"]
  ];
  lines.forEach(([tag, body], i) => {
    const y = 1.6 + i * 1.35;
    sSrc.addText(tag, { x: 0.6, y, w: 2.0, h: 0.5, fontSize: 15, bold: true, color: i === 0 ? C.ok : i === 1 ? C.warn : C.risk, fontFace: FONT });
    sSrc.addText(body, { x: 2.7, y, w: 10, h: 1.2, fontSize: 12, color: C.ink, fontFace: FONT, lineSpacingMultiple: 1.15, valign: "top" });
  });
  sSrc.addText("CPC는 네이버 검색광고 실측 입찰가만 사용(추정 금지). 경쟁사는 네이버 지역검색 OpenAPI 상한(최대 5) 표본. 성과 수치는 목표치이며 보장이 아닙니다 · 의료광고법 준수.", { x: 0.6, y: 6.2, w: 12.1, h: 0.8, fontSize: 10, color: C.sub, fontFace: FONT, lineSpacingMultiple: 1.15 });

  // ── 12. 마무리 ────────────────────────────────────────────
  const s10 = pptx.addSlide();
  s10.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: C.dark } });
  s10.addText("분석 → 제안 → 진행 → 보고", { x: 0.8, y: 2.4, w: 11.7, h: 0.6, fontSize: 20, color: C.brand, bold: true, fontFace: FONT });
  s10.addText("실측 기반 마케팅 전략을 월 단위로 실행·측정·최적화합니다.", { x: 0.8, y: 3.2, w: 11.7, h: 0.5, fontSize: 15, color: C.gray, fontFace: FONT });
  s10.addText("VENOM & MARKEPICK", { x: 0.8, y: 5.6, w: 11.7, h: 0.5, fontSize: 18, bold: true, color: C.white, fontFace: FONT });
  s10.addText("본 제안의 수치는 목표·해석이며 성과 보장이 아닙니다. 의료광고법을 준수합니다.", { x: 0.8, y: 6.6, w: 11.7, h: 0.4, fontSize: 10, color: C.sub, fontFace: FONT });

  const safe = (s.brand || "전략").replace(/[^\w가-힣]/g, "").slice(0, 20) || "전략";
  await pptx.writeFile({ fileName: `마케팅전략_${safe}_${today}.pptx` });
}
