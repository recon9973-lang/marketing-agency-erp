"use client";

/**
 * 상권분석 리포트 — 인쇄/PDF 전용 문서(가로·세로 선택).
 * "데이터 도시에(Dossier)" 아이덴티티(에메랄드·슬레이트) — 마케팅 전략(번트오렌지 브리프)과 분리.
 * 좌측 스파인 없음 → 상단 데이터 밴드 헤더 · 밀도 높은 지표 그리드/게이지/표.
 * 실제 RegionAnalysis 데이터를 바인딩. 화면 숨김 + window.print() 시 본 문서만 인쇄.
 */
import type { RegionAnalysis } from "@/server/actions/region";

export type PrintOrient = "landscape" | "portrait";

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("ko-KR"));
const pctW = (v: number, max: number) => `${Math.max(3, Math.round((v / Math.max(1, max)) * 100))}%`;

// KCD 3단 상병명(주요) — DemandRow·ProvinceRow는 코드만 담으므로 이름 매핑.
const KCD: Record<string, string> = {
  A09: "감염성 위장염", B01: "수두", E03: "갑상선기능저하", E11: "2형 당뇨", E66: "비만",
  E78: "고지혈증", F32: "우울에피소드", F41: "불안장애", G43: "편두통", H10: "결막염",
  H25: "노년백내장", I10: "고혈압", J00: "감기", J20: "급성기관지염", J30: "혈관운동성비염",
  K02: "치아우식", K05: "치주질환", K21: "위식도역류", K29: "위염", L20: "아토피피부염",
  L21: "지루피부염", L23: "알레르기접촉피부염", L24: "자극접촉피부염", L30: "기타 피부염",
  L40: "건선", L50: "두드러기", L70: "여드름", L81: "색소이상", M17: "무릎 관절증",
  M48: "척추관 협착", M51: "요추 추간판", M54: "등·허리통증", M75: "어깨병변",
  N39: "요로계질환", N40: "전립선 비대", R51: "두통", J06: "상기도 감염", J02: "인두염",
  J03: "편도염", H35: "기타 망막장애", H90: "청력 손실"
};
const kName = (code: string) => KCD[code] ?? KCD[code.slice(0, 3)] ?? "";

/** 종합 진단(규칙형) — report.ts diagnose와 동일 취지. */
function diagnose(a: RegionAnalysis): string[] {
  const out: string[] = [];
  const pop = a.population, hos = a.hospitals, nat = a.nationalPer;
  if (pop) {
    if (pop.femaleRatio != null && pop.femaleRatio >= 51) out.push(`여성 비중 ${pop.femaleRatio}%로 여초 지역 — 피부·성형·다이어트 등 여성 타깃 소구가 유효(🟡정성).`);
    else if (pop.femaleRatio != null) out.push(`여성 비중 ${pop.femaleRatio}%로 성비 균형 — 타깃은 연령축에서 정밀화 필요(🟡정성).`);
    if (pop.delta > 0) out.push(`전월 대비 인구 ▲${fmt(pop.delta)} — 유입 지역, 신규 수요 확보 여지(✅실측).`);
    else if (pop.delta < 0) out.push(`전월 대비 인구 ▼${fmt(Math.abs(pop.delta))} — 정체·감소, 기존 고객 유지·리텐션 중심(✅실측).`);
  }
  if (hos?.perTenThousand != null && nat) {
    const r = hos.perTenThousand / nat;
    if (r >= 1.2) out.push(`인구 만명당 ${hos.perTenThousand}개로 전국 평균(${nat})보다 과밀 — 차별화·검색 상위 선점이 관건(✅실측).`);
    else if (r <= 0.8) out.push(`인구 만명당 ${hos.perTenThousand}개로 전국 평균(${nat})보다 여유 — 공급 대비 수요 우위 가능성(✅실측).`);
    else out.push(`인구 만명당 ${hos.perTenThousand}개로 전국 평균(${nat}) 수준의 경쟁 강도(✅실측).`);
  }
  if (hos?.clinicToOriental != null) out.push(`의원:한의원 = ${hos.clinicToOriental}:1 — 양·한방 경쟁 구도. 검색 점유가 한방에 쏠렸다면 양방 마케팅 공백 기회(🟡정성).`);
  return out.slice(0, 4);
}

export function MarketPrintDoc({ analysis: a, orient, today }: { analysis: RegionAnalysis; orient: PrintOrient; today: string }) {
  const pop = a.population;
  const hos = a.hospitals;
  const nat = a.nationalPer;
  const sc = a.scorecard;
  const specialty = a.specialty ?? "";
  const rgn = a.resolve.label;
  const demoTag = (code: string) => {
    const d = a.demoMap[code.slice(0, 3)];
    if (!d) return "";
    return `여 ${d.femaleRatio ?? "—"}%${d.ageTop[0]?.band ? ` · ${d.ageTop[0].band}` : ""}`;
  };
  const hosBars = hos ? Object.entries(hos.counts).sort((x, y) => y[1] - x[1]).slice(0, 6) : [];
  const hosMax = Math.max(1, ...hosBars.map((r) => r[1]));
  const demand = a.demand.slice(0, 6);
  const prov = a.province.rows.slice(0, 6);
  const ages = a.demographics?.ageResolved ? a.demographics.ageBands.slice(0, 5) : [];

  return (
    <div className="venom-mpd" data-orient={orient} aria-hidden>
      <style>{CSS + `@page{ size: A4 ${orient}; margin: 0; }`}</style>

      {/* ── 커버 ── */}
      <section className="m-sheet cover">
        <div className="wm" />
        <div className="band">
          <div className="h"><div className="eyebrow">VENOM · 상권분석</div></div>
          <div className="stamp">DATA STAMP<br /><b>행안부 2026.06 · 심평원 2026.06 / 2025</b></div>
        </div>
        <div className="cover-in">
          <div className="left">
            <div className="eyebrow">Location Intelligence</div>
            <h1>상권분석<br />리포트</h1>
            <div className="rgn">{rgn}{specialty ? ` · ${specialty}` : ""}</div>
            <div className="meta">/ {today}</div>
          </div>
          <div className="right">
            <div className="kv">
              <div className="row"><span>상권 인구</span><b>{fmt(pop?.total)}</b></div>
              <div className="row"><span>병·의원</span><b>{fmt(hos?.total)}</b></div>
              <div className="row"><span>만명당(전국 {nat})</span><b>{hos?.perTenThousand ?? "—"}</b></div>
              <div className="row"><span>종합 등급</span><b>{sc ? `${sc.grade} · ${sc.overall}` : "—"}</b></div>
            </div>
            <div className="note">
              DATA ✅행안부 주민등록(2026.6) · 심평원 병원정보(2026.6)·상병통계(2025)<br />
              표기 ✅실측 · 🟡정성 · 🔴미실측 · KPI=목표치(보장 아님) · 의료광고법 준수.
            </div>
          </div>
        </div>
      </section>

      {/* ── P1 : 핵심지표 · 스코어카드 | 종합진단 ── */}
      <section className="m-sheet">
        <div className="wm" />
        <div className="band">
          <div className="h"><div className="eyebrow">Summary</div><h2>핵심 지표 · 종합 스코어카드 <span className="rgn">{rgn}</span></h2></div>
          <div className="stamp">✅ 실측 · 행안부·심평원</div>
        </div>
        <div className="content">
          <div className="cols w55">
            <div>
              <div className="modh"><span className="k">KPI</span><h3>상권 핵심 지표</h3><span className="g live">✅ 실측</span></div>
              <div className="grid">
                <div className="metric"><div className="v">{fmt(pop?.total)}</div><div className="k">상권 인구(행정동 {pop?.dongs ?? "—"})</div><div className={`d ${pop && pop.delta > 0 ? "up" : pop && pop.delta < 0 ? "dn" : "flat"}`}>{pop ? `${pop.delta >= 0 ? "▲" : "▼"} ${fmt(Math.abs(pop.delta))} 전월` : "—"}</div></div>
                <div className="metric"><div className="v">{pop?.femaleRatio ?? "—"}<small>%</small></div><div className="k">여성 비중</div><div className="d flat">{pop?.femaleRatio != null ? (pop.femaleRatio >= 52 ? "여초" : pop.femaleRatio <= 48 ? "남초" : "균형") : ""}</div></div>
                <div className="metric"><div className="v">{fmt(hos?.total)}</div><div className="k">병·의원 수</div><div className="d flat">의원 {fmt(hos?.clinic)}</div></div>
                <div className="metric"><div className="v">{hos?.perTenThousand ?? "—"}</div><div className="k">만명당(전국 {nat})</div><div className={`d ${hos?.perTenThousand != null && nat ? (hos.perTenThousand >= nat * 1.2 ? "dn" : hos.perTenThousand <= nat * 0.8 ? "up" : "flat") : "flat"}`}>{hos?.perTenThousand != null && nat ? (hos.perTenThousand >= nat * 1.2 ? "과밀" : hos.perTenThousand <= nat * 0.8 ? "여유" : "평균") : ""}</div></div>
              </div>
              {sc && (
                <>
                  <div className="modh" style={{ marginTop: "16px" }}><span className="k">SCORE</span><h3>종합 스코어카드</h3></div>
                  <div className="score">
                    <div className="gauge" style={{ ["--p" as string]: sc.overall }}><div className="gt"><div className="gn">{sc.overall}</div><div className="gg">{sc.grade}등급</div></div></div>
                    <div className="subs">
                      {sc.subs.map((s) => (
                        <div className="subrow" key={s.label}><span className="sl">{s.label}</span><span className="sv">{s.score}</span><span className="st"><span className="sf" style={{ width: `${s.score}%` }} /></span></div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div>
              <div className="modh"><span className="k">DX</span><h3>종합 진단</h3><span className="g soft">🟡 정성 해석</span></div>
              <div className="diag">
                {diagnose(a).map((d, i) => <div className="di" key={i}>{d.replace(/\(✅실측\)|\(🟡정성\)/g, "").trim()}</div>)}
              </div>
              {sc && (sc.strengths.length > 0 || sc.weaknesses.length > 0) && (
                <div className="notice" style={{ marginTop: "12px" }}>
                  {sc.strengths.length > 0 && <><b style={{ color: "var(--m-accent-strong)" }}>강점</b> {sc.strengths.join(" / ")}<br /></>}
                  {sc.weaknesses.length > 0 && <><b style={{ color: "var(--m-risk)" }}>약점</b> {sc.weaknesses.join(" / ")}</>}
                </div>
              )}
            </div>
          </div>
          <div className="foot"><span>SRC · 인구=행안부 주민등록 · 병원=심평원 병원정보 · 스코어=규칙형</span><span>VENOM · 상권분석</span></div>
        </div>
      </section>

      {/* ── P2 : 인구·성별 | 병원 밀집도 ── */}
      <section className="m-sheet">
        <div className="wm" />
        <div className="band">
          <div className="h"><div className="eyebrow">Demography · Supply</div><h2>인구·성별 &amp; 병원 밀집도</h2></div>
          <div className="stamp">✅ 실측 · 행안부·심평원</div>
        </div>
        <div className="content">
          <div className="cols">
            <div>
              <div className="modh"><span className="k">POP</span><h3>인구 · 성별</h3><span className="g live">✅ 실측</span></div>
              {pop ? (
                <>
                  <p className="sub">총 {fmt(pop.total)}명 · 행정동 {pop.dongs}개 · 전월 {pop.delta >= 0 ? "▲" : "▼"}{fmt(Math.abs(pop.delta))}</p>
                  <div className="split">
                    <div className="srow"><div className="sl2"><span>남 {fmt(pop.male)} ({pop.total ? Math.round((pop.male / pop.total) * 1000) / 10 : "—"}%)</span></div><div className="sbar m"><i style={{ width: `${pop.total ? (pop.male / pop.total) * 100 : 0}%` }} /></div></div>
                    <div className="srow"><div className="sl2"><span>여 {fmt(pop.female)} ({pop.femaleRatio ?? "—"}%)</span></div><div className="sbar f"><i style={{ width: `${pop.femaleRatio ?? 0}%` }} /></div></div>
                  </div>
                </>
              ) : <p className="sub">인구 데이터 없음</p>}
              {ages.length > 0 ? (
                <table style={{ marginTop: "12px" }}>
                  <thead><tr><th>연령대</th><th className="num">비중</th></tr></thead>
                  <tbody>{ages.map((b) => <tr key={b.label}><td>{b.label}</td><td className="num">{b.ratio}%</td></tr>)}</tbody>
                </table>
              ) : <p className="sub" style={{ marginTop: "8px" }}>🟡 연령×성별 코어는 SGIS 연동 시 정밀화(현재 총인구·성비 실측).</p>}
              {a.income && <p className="sub" style={{ marginTop: "8px" }}>💳 구매력(시도 개인소득): 전국=100 대비 <b>{a.income.index}</b> · {a.income.quintile}분위({a.income.rank}/{a.income.total}위)</p>}
            </div>
            <div>
              <div className="modh"><span className="k">HOS</span><h3>병원 밀집도 · 종별</h3><span className="g live">✅ 실측</span></div>
              {hos ? (
                <>
                  <p className="sub">전체 {fmt(hos.total)}개 · 의원:한의원 {hos.clinicToOriental ?? "—"}:1 · 만명당 {hos.perTenThousand ?? "—"}(전국 {nat})</p>
                  <div className="bars">
                    {hosBars.map(([t, n]) => (
                      <div className="bar" key={t}><span className="lab">{t}</span><span className="track"><span className="fill" style={{ width: pctW(n, hosMax) }} /></span><span className="val">{fmt(n)}</span></div>
                    ))}
                  </div>
                  {a.openings && <div className="notice" style={{ marginTop: "12px" }}><b style={{ color: "var(--m-accent-strong)" }}>개원 추세</b> — 최근 1년 {fmt(a.openings.y1)}곳 · 3년 {fmt(a.openings.y3)}곳. {a.openings.y1 >= 30 ? "신규 진입 활발(경쟁 심화) — 조기 검색 선점 유효" : a.openings.y1 <= 3 ? "신규 진입 적음(안정)" : "보통"} ✅실측.</div>}
                </>
              ) : <p className="sub">병원 데이터 없음</p>}
              {a.access && <p className="sub" style={{ marginTop: "8px" }}>🚉 광역 접근성: <b>{a.access.label}</b>({a.access.modes.join("·")}, 등급 {a.access.level}/3) ✅실측</p>}
            </div>
          </div>
          <div className="foot"><span>SRC · 인구=행안부 주민등록(2026.6) · 병원=심평원 병원정보(2026.6)</span><span>VENOM · 상권분석</span></div>
        </div>
      </section>

      {/* ── P3 : 진료과 수요 | 시도 다빈도 ── */}
      <section className="m-sheet">
        <div className="wm" />
        <div className="band">
          <div className="h"><div className="eyebrow">Demand</div><h2>진료과 수요 · 다빈도 상병</h2></div>
          <div className="stamp">✅ 실측 · 심평원 상병통계</div>
        </div>
        <div className="content">
          <div className="cols">
            <div>
              <div className="modh"><span className="k">DEM</span><h3>{specialty || "진료과"} 수요 — 주상병 상위(전국)</h3><span className="g live">✅ 실측</span></div>
              {demand.length > 0 ? (
                <>
                  <p className="sub">심평원 표시과목별 상병통계 — 전국 {specialty} 의원 주상병별 연간 환자수(실수요 구조)</p>
                  <table>
                    <thead><tr><th>#</th><th>주상병</th><th className="num">환자수</th><th>타깃</th></tr></thead>
                    <tbody>
                      {demand.map((d, i) => (
                        <tr key={d.code}><td className="num">{i + 1}</td><td><span className="code">{d.code}</span> {kName(d.code)}</td><td className="num">{fmt(d.patients)}</td><td className="tgt">{demoTag(d.code)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : <p className="sub">진료과 미선택 또는 수요 데이터 없음(진료과 선택 시 표시).</p>}
            </div>
            <div>
              <div className="modh"><span className="k">SIDO</span><h3>{a.province.sido} 다빈도 상병(양방·시도)</h3><span className="g live">✅ 실측</span></div>
              {prov.length > 0 ? (
                <>
                  <p className="sub">심평원 시도별 진료통계(2024) · {a.province.sido} {a.province.specialtyFiltered ? `${specialty} 관련` : "전 진료과"} 외래 환자수 상위</p>
                  <table>
                    <thead><tr><th>상병</th><th className="num">환자수</th><th>타깃</th></tr></thead>
                    <tbody>
                      {prov.map((d) => (
                        <tr key={d.code}><td><span className="code">{d.code}</span> {kName(d.code)}</td><td className="num">{fmt(d.patients)}</td><td className="tgt">{demoTag(d.code)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : <p className="sub">시도 다빈도 데이터 없음</p>}
            </div>
          </div>
          <div className="foot"><span>SRC · 심평원 표시과목별·시도별 상병통계(2024–2025) ✅실측</span><span>VENOM · 상권분석</span></div>
        </div>
      </section>

      {/* ── P4 : 데이터 출처·고지 ── */}
      <section className="m-sheet">
        <div className="wm" />
        <div className="band">
          <div className="h"><div className="eyebrow">Appendix</div><h2>데이터 출처 · 고지</h2></div>
          <div className="stamp">DATA GRADE</div>
        </div>
        <div className="content">
          {(() => {
            const measured: string[] = [];
            const missing: string[] = [];
            (pop ? measured : missing).push("인구·성별(행안부 주민등록 2026.6)");
            (hos ? measured : missing).push("병원 밀집도·종별·개원추세(심평원 병원정보 2026.6)");
            (a.demand.length ? measured : missing).push("진료과 주상병 수요(심평원 상병통계)");
            (a.province.rows.length ? measured : missing).push("시도 다빈도 상병(심평원)");
            (a.demographics?.ageResolved ? measured : missing).push("연령×성별 코어(SGIS)");
            missing.push("양방 시군구 단위 진료인원(현재 시도 단위)");
            missing.push("경쟁사 플레이스 순위·리뷰(네이버 지역검색 별도)");
            return (
              <div className="cols">
                <div>
                  <div className="modh"><span className="k">SRC</span><h3>데이터 상태</h3></div>
                  <div className="legend">
                    <div className="leg"><div className="lt g">✅ 실측</div><div className="lb">{measured.length ? measured.join(" · ") : "—"}</div></div>
                    <div className="leg"><div className="lt w">🟡 정성</div><div className="lb">타깃 소구·양한방 공백·경쟁 밀집 해석 — 실측 지표 기반 규칙형 판단.</div></div>
                    <div className="leg"><div className="lt r">🔴 미실측</div><div className="lb">{missing.join(" · ")}</div></div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <div className="notice"><b style={{ color: "var(--m-accent-strong)" }}>고지</b> — 본 자료의 성과 수치는 <b>목표치이며 보장이 아닙니다.</b> 상권 지표는 공공데이터(행안부·심평원) 실측이며, 진료과 수요는 전국 실수요 구조(지역 아님)입니다. 의료광고법을 준수합니다(효과·최상급·전후 강조 금지).</div>
                  <div style={{ marginTop: "auto", textAlign: "center", paddingTop: "16mm" }}>
                    <div style={{ fontSize: "13pt", fontWeight: 800, letterSpacing: ".22em", color: "var(--m-accent)" }}>VENOM &amp; MARKEPICK</div>
                    <div style={{ fontSize: "8.5pt", color: "var(--m-muted)", marginTop: "6px", fontFamily: "var(--m-mono)" }}>Location Intelligence · 실측 공공데이터 기반 상권 진단</div>
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="foot"><span>GEN · VENOM ERP · /market · {today}</span><span>VENOM · 상권분석</span></div>
        </div>
      </section>
    </div>
  );
}

const CSS = `
.venom-mpd{ --m-paper:#f7f9f8; --m-edge:#fff; --m-ink:#0f172a; --m-ink-soft:#3f4a46; --m-muted:#6b7772;
  --m-line:#e2e8e5; --m-line-strong:#cdd8d3; --m-accent:#059669; --m-accent-strong:#047a54; --m-wash:#e7f4ee;
  --m-cover:#0c1512; --m-good:#059669; --m-watch:#c2830e; --m-risk:#dc4d4d; --m-sky:#0ea5b7;
  --m-sans:"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",system-ui,-apple-system,sans-serif;
  --m-mono:"SF Mono","JetBrains Mono",ui-monospace,"Consolas",monospace;
  font-family:var(--m-sans); color:var(--m-ink); line-height:1.5; }
@media screen{ .venom-mpd{ display:none; } }
.venom-mpd .m-sheet{ background:var(--m-paper); position:relative; overflow:hidden; display:flex; flex-direction:column; }
.venom-mpd[data-orient="landscape"] .m-sheet{ width:297mm; min-height:210mm; }
.venom-mpd[data-orient="portrait"] .m-sheet{ width:210mm; min-height:297mm; }
.venom-mpd .wm{ position:absolute; top:52%; left:50%; transform:translate(-50%,-50%) rotate(-22deg); font-size:52pt; font-weight:800; color:rgba(5,150,105,.05); letter-spacing:.1em; white-space:nowrap; pointer-events:none; z-index:0; }
.venom-mpd .band{ background:var(--m-ink); color:#fff; padding:9mm 14mm 7mm; position:relative; z-index:1; display:flex; align-items:flex-end; justify-content:space-between; gap:16px; }
.venom-mpd .band::before{ content:""; position:absolute; left:0; top:0; width:100%; height:3px; background:linear-gradient(90deg,var(--m-accent),var(--m-sky)); }
.venom-mpd .band .h .eyebrow{ font-size:8pt; letter-spacing:.34em; font-weight:700; color:#7fd8b5; text-transform:uppercase; }
.venom-mpd .band .h h2{ margin:3px 0 0; font-size:18pt; font-weight:800; letter-spacing:-.01em; }
.venom-mpd .band .h .rgn{ color:#9fb3ab; font-weight:600; }
.venom-mpd .band .stamp{ text-align:right; font-size:7.5pt; color:#8ba39a; line-height:1.5; font-family:var(--m-mono); }
.venom-mpd .band .stamp b{ color:#cfe4db; }
.venom-mpd .content{ padding:9mm 14mm 12mm; position:relative; z-index:1; flex:1; display:flex; flex-direction:column; }
.venom-mpd .cols{ display:grid; grid-template-columns:1fr 1fr; gap:12mm; align-items:start; flex:1; }
.venom-mpd .cols.w55{ grid-template-columns:1.1fr .9fr; }
.venom-mpd[data-orient="portrait"] .cols{ grid-template-columns:1fr; gap:8mm; }
.venom-mpd .modh{ display:flex; align-items:center; gap:8px; margin-bottom:9px; }
.venom-mpd .modh .k{ font-family:var(--m-mono); font-size:7.5pt; font-weight:700; color:#fff; background:var(--m-accent); padding:2px 7px; border-radius:5px; letter-spacing:.04em; }
.venom-mpd .modh h3{ margin:0; font-size:11pt; font-weight:800; }
.venom-mpd .modh .g{ margin-left:auto; font-size:7.5pt; font-weight:700; padding:2px 7px; border-radius:999px; }
.venom-mpd .g.live{ color:var(--m-good); background:color-mix(in srgb,var(--m-good) 12%,#fff); }
.venom-mpd .g.soft{ color:var(--m-watch); background:color-mix(in srgb,var(--m-watch) 14%,#fff); }
.venom-mpd .sub{ font-size:8pt; color:var(--m-muted); margin:0 0 8px; }
.venom-mpd p{ margin:0 0 8px; }
.venom-mpd .grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.venom-mpd[data-orient="portrait"] .grid{ grid-template-columns:repeat(2,1fr); }
.venom-mpd .metric{ border:1px solid var(--m-line); border-radius:9px; padding:10px 11px; background:var(--m-edge); }
.venom-mpd .metric .v{ font-size:18pt; font-weight:800; line-height:1; font-variant-numeric:tabular-nums; letter-spacing:-.02em; }
.venom-mpd .metric .v small{ font-size:9pt; color:var(--m-muted); font-weight:700; }
.venom-mpd .metric .k{ font-size:7.5pt; color:var(--m-muted); margin-top:6px; }
.venom-mpd .metric .d{ font-size:7pt; font-weight:700; margin-top:3px; }
.venom-mpd .d.up{ color:var(--m-good); } .venom-mpd .d.dn{ color:var(--m-risk); } .venom-mpd .d.flat{ color:var(--m-muted); }
.venom-mpd .score{ display:grid; grid-template-columns:auto 1fr; gap:16px; align-items:center; border:1px solid var(--m-line); border-radius:11px; padding:13px 15px; background:var(--m-edge); }
.venom-mpd .gauge{ width:92px; height:92px; border-radius:50%; display:grid; place-items:center; background:conic-gradient(var(--m-accent) calc(var(--p)*1%), color-mix(in srgb,var(--m-line) 80%,#fff) 0); position:relative; }
.venom-mpd .gauge::before{ content:""; position:absolute; inset:11px; border-radius:50%; background:var(--m-edge); }
.venom-mpd .gauge .gt{ position:relative; text-align:center; }
.venom-mpd .gauge .gn{ font-size:19pt; font-weight:800; line-height:1; font-variant-numeric:tabular-nums; }
.venom-mpd .gauge .gg{ font-size:8pt; color:var(--m-muted); font-weight:700; }
.venom-mpd .subs{ display:grid; grid-template-columns:1fr 1fr; gap:6px 16px; }
.venom-mpd .subrow{ display:grid; grid-template-columns:1fr 30px; align-items:center; gap:8px; font-size:8pt; }
.venom-mpd .subrow .st{ height:6px; background:color-mix(in srgb,var(--m-line) 75%,#fff); border-radius:3px; overflow:hidden; grid-column:1/-1; margin-top:2px; }
.venom-mpd .subrow .sf{ height:100%; background:var(--m-accent); border-radius:3px; }
.venom-mpd .subrow .sl{ color:var(--m-ink-soft); } .venom-mpd .subrow .sv{ text-align:right; font-weight:700; font-variant-numeric:tabular-nums; }
.venom-mpd table{ width:100%; border-collapse:collapse; font-size:8pt; }
.venom-mpd thead th{ text-align:left; font-weight:700; color:var(--m-muted); font-size:7pt; text-transform:uppercase; letter-spacing:.04em; padding:5px 7px; border-bottom:1.5px solid var(--m-line-strong); }
.venom-mpd tbody td{ padding:5.5px 7px; border-bottom:1px solid var(--m-line); }
.venom-mpd tbody tr:last-child td{ border-bottom:0; }
.venom-mpd td.num,.venom-mpd th.num{ text-align:right; font-variant-numeric:tabular-nums; }
.venom-mpd td.code,.venom-mpd .code{ font-family:var(--m-mono); font-weight:700; color:var(--m-accent-strong); }
.venom-mpd .tgt{ font-size:7pt; color:var(--m-risk); }
.venom-mpd .split{ display:flex; flex-direction:column; gap:8px; }
.venom-mpd .srow .sl2{ display:flex; justify-content:space-between; font-size:8pt; margin-bottom:3px; color:var(--m-ink-soft); }
.venom-mpd .sbar{ height:11px; border-radius:6px; overflow:hidden; }
.venom-mpd .sbar.m{ background:color-mix(in srgb,var(--m-sky) 22%,#fff); } .venom-mpd .sbar.m i{ display:block; height:100%; background:var(--m-sky); }
.venom-mpd .sbar.f{ background:color-mix(in srgb,var(--m-risk) 16%,#fff); } .venom-mpd .sbar.f i{ display:block; height:100%; background:var(--m-risk); }
.venom-mpd .bars{ display:flex; flex-direction:column; gap:6px; }
.venom-mpd .bar{ display:grid; grid-template-columns:64px 1fr 44px; align-items:center; gap:9px; font-size:8pt; }
.venom-mpd .bar .lab{ color:var(--m-ink-soft); text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.venom-mpd .bar .track{ height:9px; background:color-mix(in srgb,var(--m-line) 75%,#fff); border-radius:5px; overflow:hidden; }
.venom-mpd .bar .fill{ height:100%; border-radius:5px; background:linear-gradient(90deg,var(--m-accent),var(--m-sky)); }
.venom-mpd .bar .val{ text-align:right; font-weight:700; font-variant-numeric:tabular-nums; }
.venom-mpd .diag{ display:flex; flex-direction:column; gap:6px; }
.venom-mpd .diag .di{ font-size:8.5pt; color:var(--m-ink-soft); padding-left:12px; position:relative; }
.venom-mpd .diag .di::before{ content:""; position:absolute; left:0; top:6px; width:5px; height:5px; border-radius:50%; background:var(--m-accent); }
.venom-mpd .notice{ padding:10px 12px; border-radius:9px; background:var(--m-wash); border:1px solid var(--m-accent); font-size:8pt; color:var(--m-ink-soft); line-height:1.5; }
.venom-mpd .legend{ display:flex; flex-direction:column; gap:8px; }
.venom-mpd .leg{ display:grid; grid-template-columns:66px 1fr; gap:12px; padding:9px 12px; border:1px solid var(--m-line); border-radius:9px; background:var(--m-edge); }
.venom-mpd .leg .lt{ font-size:8.5pt; font-weight:800; } .venom-mpd .leg .lt.g{ color:var(--m-good); } .venom-mpd .leg .lt.w{ color:var(--m-watch); } .venom-mpd .leg .lt.r{ color:var(--m-muted); }
.venom-mpd .leg .lb{ font-size:8pt; color:var(--m-ink-soft); line-height:1.5; }
.venom-mpd .foot{ display:flex; justify-content:space-between; align-items:center; font-size:7.5pt; color:var(--m-muted); border-top:1px solid var(--m-line); padding-top:6px; margin-top:12px; font-family:var(--m-mono); }
.venom-mpd .foot b{ color:var(--m-ink-soft); }
.venom-mpd .cover{ background:var(--m-cover); color:#fff; }
.venom-mpd .cover .band{ background:transparent; }
.venom-mpd .cover-in{ flex:1; padding:0 20mm 16mm; display:grid; grid-template-columns:1.15fr .85fr; gap:16mm; align-items:center; position:relative; z-index:1; }
.venom-mpd[data-orient="portrait"] .cover-in{ grid-template-columns:1fr; align-content:center; gap:10mm; }
.venom-mpd .cover .eyebrow{ font-size:11pt; font-weight:800; letter-spacing:.3em; color:#7fd8b5; text-transform:uppercase; }
.venom-mpd .cover h1{ font-size:40pt; font-weight:800; letter-spacing:-.025em; line-height:1.02; margin:10px 0 0; }
.venom-mpd .cover .rgn{ font-size:15pt; color:#9fb3ab; margin-top:14px; }
.venom-mpd .cover .meta{ font-size:11pt; color:#7f938b; margin-top:8px; font-family:var(--m-mono); }
.venom-mpd .cover .right{ border-left:1px solid rgba(255,255,255,.14); padding-left:16mm; }
.venom-mpd[data-orient="portrait"] .cover .right{ border-left:0; padding-left:0; border-top:1px solid rgba(255,255,255,.14); padding-top:12mm; }
.venom-mpd .cover .kv{ display:flex; flex-direction:column; gap:9px; }
.venom-mpd .cover .kv .row{ display:flex; justify-content:space-between; font-size:9pt; border-bottom:1px dashed rgba(255,255,255,.14); padding-bottom:7px; }
.venom-mpd .cover .kv .row span{ color:#9fb3ab; } .venom-mpd .cover .kv .row b{ font-variant-numeric:tabular-nums; font-size:11pt; }
.venom-mpd .cover .note{ font-size:8pt; color:#6f847b; margin-top:18px; line-height:1.55; font-family:var(--m-mono); }
@media print{
  body *{ visibility:hidden !important; }
  .venom-mpd, .venom-mpd *{ visibility:visible !important; }
  .venom-mpd{ display:block !important; position:absolute; left:0; top:0; width:100%; }
  .venom-mpd .m-sheet{ break-after:page; box-shadow:none; }
  .venom-mpd .m-sheet:last-child{ break-after:auto; }
}
`;
