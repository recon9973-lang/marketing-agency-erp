// 상권분석 PPT(11슬라이드) 생성 — pptxgenjs 를 브라우저에서 동적 로드해 즉시 다운로드.
// location-auto deck_template 구조를 ERP 실측 데이터로 채운다. (색상 6-hex·# 금지, Malgun Gothic)
import type { RegionAnalysis } from "@/server/actions/region";
import type { FacilityRadius } from "@/server/data/region-insight";

const C = { brand: "059669", ink: "0F172A", sub: "64748B", light: "F1F5F9", line: "E2E8F0", sky: "0EA5E9", rose: "F43F5E", white: "FFFFFF" };
const FONT = "Malgun Gothic";

const KCD: Record<string, string> = {
  A09: "감염성 위장염", E11: "2형 당뇨", E66: "비만", E78: "고지혈증", H10: "결막염",
  H25: "노년백내장", I10: "고혈압", J00: "감기", J20: "급성기관지염", J30: "혈관운동성비염",
  K02: "충치", K05: "치주질환", K21: "위식도역류", K29: "위염", L20: "아토피",
  L30: "피부염", L50: "두드러기", L70: "여드름", M54: "요통", M75: "어깨병변", N39: "요로질환", R51: "두통"
};

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("ko-KR"));

export type DeckInput = {
  analysis: RegionAnalysis;
  brand: string;
  radius: FacilityRadius | null;
  today: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Slide = any;

export async function downloadMarketDeck({ analysis, brand, radius, today }: DeckInput): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pptx.defineSlideMaster({ title: "M", background: { color: C.white } });

  const label = analysis.resolve.label;
  const specialty = analysis.specialty ?? "";
  const pop = analysis.population;
  const hos = analysis.hospitals;
  const nat = analysis.nationalPer;

  const head = (s: Slide, t: string, no: number) => {
    s.addText(t, { x: 0.6, y: 0.35, w: 11, h: 0.6, fontSize: 24, bold: true, color: C.ink, fontFace: FONT });
    s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.0, w: 1.2, h: 0.06, fill: { color: C.brand } });
    s.addText(`${no}`, { x: 12.4, y: 0.35, w: 0.5, h: 0.5, fontSize: 14, color: C.sub, align: "right", fontFace: FONT });
    s.addText("실측: 행안부·심평원", { x: 9.5, y: 6.95, w: 3.3, h: 0.35, fontSize: 9, color: C.sub, align: "right", fontFace: FONT });
  };
  const bar = (s: Slide, x: number, y: number, wMax: number, ratio: number, color: string) =>
    s.addShape(pptx.ShapeType.rect, { x, y, w: Math.max(0.03, wMax * Math.min(1, ratio)), h: 0.22, fill: { color } });

  // 1. 표지
  const s1 = pptx.addSlide();
  s1.background = { color: C.ink };
  s1.addText("상권분석 리포트", { x: 0.8, y: 2.2, w: 11.7, h: 0.6, fontSize: 20, color: C.brand, bold: true, fontFace: FONT });
  s1.addText(`${label}${specialty ? ` · ${specialty}` : ""}`, { x: 0.8, y: 2.9, w: 11.7, h: 1.0, fontSize: 40, color: C.white, bold: true, fontFace: FONT });
  s1.addText(`${brand || "일반형 제안"} · ${today}`, { x: 0.8, y: 4.1, w: 11.7, h: 0.5, fontSize: 16, color: C.light, fontFace: FONT });
  s1.addText("데이터: 행안부 주민등록(2026.6) · 심평원 병원정보(2026.6)·상병통계(2025) — ✅실측", { x: 0.8, y: 6.6, w: 11.7, h: 0.4, fontSize: 11, color: C.sub, fontFace: FONT });

  // 2. 요약
  const s2 = pptx.addSlide();
  head(s2, "핵심 요약", 2);
  const cards: [string, string][] = [
    [fmt(pop?.total), "상권 인구"],
    [`${pop?.femaleRatio ?? "—"}%`, "여성 비중"],
    [fmt(hos?.total), "병·의원 수"],
    [`${hos?.perTenThousand ?? "—"}`, `만명당(전국 ${nat})`]
  ];
  cards.forEach(([v, k], i) => {
    const x = 0.6 + i * 3.05;
    s2.addShape(pptx.ShapeType.rect, { x, y: 1.6, w: 2.8, h: 1.7, fill: { color: C.light }, line: { color: C.line, width: 1 } });
    s2.addText(v, { x, y: 1.9, w: 2.8, h: 0.8, fontSize: 30, bold: true, color: C.brand, align: "center", fontFace: FONT });
    s2.addText(k, { x, y: 2.7, w: 2.8, h: 0.4, fontSize: 12, color: C.sub, align: "center", fontFace: FONT });
  });
  const dense = hos?.perTenThousand != null && nat ? hos.perTenThousand / nat : null;
  const verdict = dense == null ? "" : dense >= 1.2 ? "전국 평균 대비 과밀 — 차별화·검색 상위 선점이 관건." : dense <= 0.8 ? "전국 평균 대비 여유 — 공급 대비 수요 우위 가능." : "전국 평균 수준의 경쟁 강도.";
  s2.addText(`· ${verdict}`, { x: 0.6, y: 3.9, w: 12, h: 0.5, fontSize: 15, color: C.ink, fontFace: FONT });

  // 3. 인구·성별
  const s3 = pptx.addSlide();
  head(s3, "1. 인구 · 성별", 3);
  if (pop) {
    s3.addText(`총 ${fmt(pop.total)}명 · 행정동 ${pop.dongs}개 · 전월 ${pop.delta >= 0 ? "▲" : "▼"}${fmt(Math.abs(pop.delta))}`, { x: 0.6, y: 1.5, w: 12, h: 0.5, fontSize: 16, color: C.ink, fontFace: FONT });
    const total = pop.total || 1;
    s3.addText(`남 ${fmt(pop.male)}`, { x: 0.6, y: 2.4, w: 3, h: 0.3, fontSize: 12, color: C.sub, fontFace: FONT });
    bar(s3, 0.6, 2.75, 11, pop.male / total, C.sky);
    s3.addText(`여 ${fmt(pop.female)} (${pop.femaleRatio ?? "—"}%)`, { x: 0.6, y: 3.3, w: 4, h: 0.3, fontSize: 12, color: C.sub, fontFace: FONT });
    bar(s3, 0.6, 3.65, 11, pop.female / total, C.rose);
  }

  // 4. 병원 밀집도
  const s4 = pptx.addSlide();
  head(s4, "2. 병원 밀집도 · 종별", 4);
  if (hos) {
    const rows = Object.entries(hos.counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxV = Math.max(1, ...rows.map((r) => r[1]));
    rows.forEach(([t, n], i) => {
      const y = 1.6 + i * 0.6;
      s4.addText(t, { x: 0.6, y, w: 2, h: 0.3, fontSize: 11, color: C.ink, align: "right", fontFace: FONT });
      bar(s4, 2.8, y + 0.02, 8, n / maxV, C.brand);
      s4.addText(fmt(n), { x: 11, y, w: 1.5, h: 0.3, fontSize: 11, bold: true, color: C.ink, fontFace: FONT });
    });
    s4.addText(`의원:한의원 ${hos.clinicToOriental ?? "—"}:1 · 인구 만명당 ${hos.perTenThousand ?? "—"}개(전국 ${nat})`, { x: 0.6, y: 6.4, w: 12, h: 0.4, fontSize: 12, color: C.sub, fontFace: FONT });
  }

  // 5. 진료과 수요 (선택)
  if (specialty && analysis.demand.length) {
    const s5 = pptx.addSlide();
    head(s5, `3. ${specialty} 수요 — 주상병 상위 (전국)`, 5);
    const rows = analysis.demand.slice(0, 8);
    const maxP = Math.max(1, ...rows.map((r) => r.patients));
    rows.forEach((d, i) => {
      const y = 1.6 + i * 0.6;
      s5.addText(`${d.code} ${KCD[d.code] ?? ""}`, { x: 0.6, y, w: 3, h: 0.3, fontSize: 11, color: C.ink, fontFace: FONT });
      bar(s5, 3.7, y + 0.02, 7, d.patients / maxP, C.sky);
      s5.addText(fmt(d.patients), { x: 11, y, w: 1.7, h: 0.3, fontSize: 11, bold: true, color: C.ink, fontFace: FONT });
    });
    s5.addText("심평원 표시과목별 상병통계 — 전국 실수요 구조(지역 아님).", { x: 0.6, y: 6.5, w: 12, h: 0.4, fontSize: 10, color: C.sub, fontFace: FONT });
  }

  // 6. 반경 경쟁 (좌표 있을 때)
  if (radius?.facility && radius.all && radius.sameType) {
    const s6 = pptx.addSlide();
    head(s6, "경쟁 — 반경 밀집도", 6);
    s6.addText(`기준: ${radius.facility.name} (${radius.facility.type}) · 반경 ${radius.radiusKm}km`, { x: 0.6, y: 1.5, w: 12, h: 0.4, fontSize: 14, color: C.ink, fontFace: FONT });
    [[fmt(radius.sameType.total), `동종(${radius.facility.type}) 경쟁`], [fmt(radius.all.total), "전체 병·의원"]].forEach(([v, k], i) => {
      const x = 0.6 + i * 6.2;
      s6.addShape(pptx.ShapeType.rect, { x, y: 2.3, w: 5.8, h: 1.8, fill: { color: C.light }, line: { color: C.line, width: 1 } });
      s6.addText(v as string, { x, y: 2.6, w: 5.8, h: 0.9, fontSize: 40, bold: true, color: C.brand, align: "center", fontFace: FONT });
      s6.addText(k as string, { x, y: 3.5, w: 5.8, h: 0.4, fontSize: 13, color: C.sub, align: "center", fontFace: FONT });
    });
  }

  // 7. 전략
  const s7 = pptx.addSlide();
  head(s7, "전략 방향", 7);
  const strat = [
    specialty ? `${specialty} 실수요 상병 기반 콘텐츠·질문 설계로 검색·AI 답변 선점` : "지역 핵심 키워드 콘텐츠로 검색 유입 확보",
    "네이버 플레이스 최적화 + 블로그/상세페이지 자산화",
    "GEO(AI 답변 인용) + 월보장 순위 관리 이중 트랙",
    "리뷰·후기 축적으로 전환·재방문 강화"
  ];
  strat.forEach((t, i) => s7.addText(`•  ${t}`, { x: 0.8, y: 1.7 + i * 0.9, w: 11.7, h: 0.6, fontSize: 16, color: C.ink, fontFace: FONT }));
  s7.addText("※ 의료광고법 준수 — 효과 보장·최상급·전후 강조 표현 금지. KPI는 목표치.", { x: 0.8, y: 6.5, w: 12, h: 0.4, fontSize: 11, color: C.rose, fontFace: FONT });

  // 8. 예산(제안)
  const s8 = pptx.addSlide();
  head(s8, "예산 배분 (월 200만원 기준 · 예시)", 8);
  const mix: [string, string, string][] = [
    ["콘텐츠 제작(블로그·상세페이지)", "40%", "80만"],
    ["네이버 플레이스·검색광고", "25%", "50만"],
    ["GEO·SEO(AI 답변·순위)", "20%", "40만"],
    ["리뷰·후기·CRM 관리", "15%", "30만"]
  ];
  s8.addTable(
    [
      [
        { text: "채널", options: { bold: true, color: C.white, fill: { color: C.brand } } },
        { text: "비중", options: { bold: true, color: C.white, fill: { color: C.brand } } },
        { text: "월 예산", options: { bold: true, color: C.white, fill: { color: C.brand } } }
      ],
      ...mix.map((r) => r.map((c) => ({ text: c, options: { color: C.ink } })))
    ],
    { x: 0.6, y: 1.7, w: 8.5, fontSize: 14, fontFace: FONT, border: { type: "solid", color: C.line, pt: 1 }, rowH: 0.55 }
  );

  // 9. 출처·고지
  const s9 = pptx.addSlide();
  head(s9, "데이터 출처 · 고지", 9);
  const notes = [
    "✅실측: 인구·성별(행안부 주민등록 2026.6), 병원 밀집도·종별·좌표(심평원 병원정보 2026.6), 진료과 주상병 수요(심평원 상병통계 2025)",
    "🟡정성: 타깃 소구·양한방 마케팅 공백 등 해석",
    "🔴미실측: 지역별 진료인원, 경쟁사 플레이스 순위·리뷰(네이버 지역검색 별도), 연령×성별 코어(SGIS 연동 시)",
    "본 자료의 성과 수치는 목표치이며 보장이 아닙니다. 의료광고법을 준수합니다."
  ];
  notes.forEach((t, i) => s9.addText(t, { x: 0.7, y: 1.7 + i * 1.0, w: 12, h: 0.9, fontSize: 13, color: i === 3 ? C.rose : C.ink, fontFace: FONT }));

  await pptx.writeFile({ fileName: `상권분석_${label}${specialty ? `_${specialty}` : ""}.pptx` });
}
