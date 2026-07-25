"use client";

/**
 * 마케팅 전략 브리프 — 인쇄/PDF 전용 문서(가로·세로 선택).
 * "전략 브리핑" 아이덴티티(번트오렌지 컨설팅 톤) — 상권분석(초록 데이터리포트)과 분리.
 * 실제 MarketingStrategy 데이터를 바인딩하고, 연결 상태에 따라 ✅실측/⚪미연결을 정직 표기.
 * 화면에선 숨김(display:none), window.print() 시에만 본 문서만 인쇄(visibility 격리 + @page).
 */
import type { MarketingStrategy } from "@/server/actions/strategy";

export type PrintOrient = "landscape" | "portrait";

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("ko-KR"));
const won = (w: number) => `${Math.round(w / 10000).toLocaleString("ko-KR")}`;
const compClass = (c: string | null) => (c === "높음" ? "hi" : c === "낮음" ? "lo" : "mid");
const pctWidth = (v: number, max: number) => `${Math.max(3, Math.round((v / Math.max(1, max)) * 100))}%`;

/** 연결 상태 배지(실측/미연결). */
function Grade({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`spd-tag ${ok ? "live" : "miss"}`}>{ok ? "✅" : "⚪"} {label}</span>;
}

export function StrategyPrintDoc({ strategy: s, orient, today }: { strategy: MarketingStrategy; orient: PrintOrient; today: string }) {
  const label = `${s.regionLabel}${s.specialty ? ` · ${s.specialty}` : ""}`;
  const a = s.acquisition?.review ?? null;
  const kwRows = s.keywords.rows.slice(0, 8);
  const kwMax = Math.max(1, ...kwRows.map((r) => r.total ?? 0));
  const topVol = s.keywords.rows.filter((r) => (r.total ?? 0) > 0).slice(0, 7);
  const funnel = s.journey?.funnel ?? [];
  const doc = `${s.brand} · 마케팅 전략 브리프`;

  return (
    <div className="venom-spd" data-orient={orient} aria-hidden>
      <style>{CSS + `@page{ size: A4 ${orient}; margin: 0; }`}</style>

      {/* ── 커버 ── */}
      <section className="spd-sheet cover">
        <div className="cover-in">
          <div className="wm" />
          <div className="left">
            <div className="kicker">VENOM · 마케팅 전략</div>
            <div className="client">{s.brand}</div>
            <h1>마케팅 전략<br />브리프</h1>
            <div className="meta">{label} &nbsp;·&nbsp; {today}</div>
          </div>
          <div className="right">
            <div className="chips">
              {["수주 진단", "키워드 실측", "검색 여정·퍼널", "SEO·GEO 정밀진단", "경쟁사", "의료광고 리스크", "광고 예산(CPC 실측)", "채널 점유"].map((c) => (
                <span className="chip" key={c}>{c}</span>
              ))}
            </div>
            <div className="foot2">
              데이터: <b>네이버 검색광고</b>(키워드·CPC 실측) · <b>네이버 지역검색·블로그</b>(경쟁·포화) · <b>VENOM SEO/GEO 엔진</b> · 심평원·행안부(상권).<br /><br />
              표기 ✅실측 · 🟡정성/추정 · ⚪미연결 · KPI는 목표치(보장 아님) · <b>의료광고법(§56)</b> 준수 · CPC는 실측 입찰가만(추정 없음).
            </div>
          </div>
        </div>
      </section>

      {/* ── P1 : 핵심 요약 · 수주진단 | 검색여정 ── */}
      <section className="spd-sheet">
        <div className="spine"><div className="rail-dot" /><div className="rail-label">Strategy Brief · VENOM</div></div>
        <div className="body">
          <div className="runhead"><span className="doc">{doc}</span><span className="pg">전략 브리프</span></div>
          <div className="cols">
            <div>
              <div className="colhd"><span className="n">01</span><h3>핵심 요약 &amp; 수주 진단</h3><span className="spd-tag soft">🟡 단계=해석</span></div>
              <div className="kpis">
                <div className="kpi"><div className="v">{a ? a.overallScore : "—"}<small>/100</small></div><div className="k">수주 진단{a ? ` (${a.stage})` : ""}</div></div>
                <div className="kpi"><div className="v">{s.keywords.rows.length}</div><div className="k">실측 키워드 {s.keywords.searchConnected ? "✅" : "⚪"}</div></div>
                <div className="kpi"><div className="v">{s.competitors.places.length}</div><div className="k">경쟁사 표본</div></div>
                <div className="kpi"><div className="v">{s.seo.ok ? s.seo.score : "—"}<small>/100</small></div><div className="k">SEO·GEO{s.seo.ok ? ` (${s.seo.grade})` : ""}</div></div>
              </div>
              {a?.headline && <div className="verdict"><span className="badge">대응 우선</span><p>{a.headline}</p></div>}
              {a?.actions?.length ? (
                <div className="actions">
                  {a.actions.slice(0, 3).map((x, i) => (
                    <div className="a" key={i}><b>{i + 1}.</b> {x.title} — {x.how}</div>
                  ))}
                </div>
              ) : null}
            </div>
            <div>
              <div className="colhd"><span className="n">02</span><h3>검색 여정 · 퍼널 전략</h3></div>
              <p className="sub">문제인식 → 정보탐색 → 비교 → 병원검토 → 예약 (5단 여정 실측 근사)</p>
              <div className="funnel">
                {funnel.slice(0, 3).map((f, i) => (
                  <div className="fcard" key={i}>
                    <div className="fh">{f.funnel}</div>
                    <div className="fmid"><div className="fg">{f.goal}</div><div className="fm">{f.message}</div></div>
                    <div className="fk">{f.channels.join("·")}<br />검색수 {fmt(f.searchVolume)}</div>
                  </div>
                ))}
                {funnel.length === 0 && <p className="sub">여정 데이터 없음(진료과 선택 시 정확도 상승).</p>}
              </div>
            </div>
          </div>
          <div className="foot"><span className="src"><b>출처</b> 수주 진단=규칙형 해석 · 검색수=네이버 검색광고{s.keywords.searchConnected ? " 실측" : "(미연동)"}</span><span>VENOM &amp; MARKEPICK</span></div>
        </div>
      </section>

      {/* ── P2 : 키워드 실측 | SEO·GEO ── */}
      <section className="spd-sheet">
        <div className="spine"><div className="rail-dot" /><div className="rail-label">Strategy Brief · VENOM</div></div>
        <div className="body">
          <div className="runhead"><span className="doc">{doc}</span><span className="pg">전략 브리프</span></div>
          <div className="cols w60">
            <div>
              <div className="colhd"><span className="n">03</span><h3>키워드 실측</h3><Grade ok={s.keywords.searchConnected} label="네이버 검색광고" /></div>
              <table>
                <thead><tr><th>키워드</th><th className="num">월검색수</th><th>경쟁</th><th className="num">블로그</th><th>포화</th></tr></thead>
                <tbody>
                  {kwRows.map((r) => (
                    <tr key={r.keyword}>
                      <td className="kw">{r.keyword}</td>
                      <td className="num">{fmt(r.total)}</td>
                      <td><span className={`comp ${compClass(r.competition)}`}>{r.competition ?? "—"}</span></td>
                      <td className="num">{fmt(r.blogDocs)}</td>
                      <td>{r.saturation ?? "—"}</td>
                    </tr>
                  ))}
                  {kwRows.length === 0 && <tr><td colSpan={5}>키워드 결과 없음</td></tr>}
                </tbody>
              </table>
            </div>
            <div>
              <div className="colhd"><span className="n">·</span><h3>월검색량 상위</h3></div>
              <div className="bars">
                {topVol.map((r) => (
                  <div className="bar" key={r.keyword}>
                    <span className="lab">{r.keyword}</span>
                    <span className="track"><span className="fill" style={{ width: pctWidth(r.total ?? 0, kwMax) }} /></span>
                    <span className="val">{fmt(r.total)}</span>
                  </div>
                ))}
                {topVol.length === 0 && <p className="sub">검색량 실측치 없음(네이버 검색광고 연결 시 표시).</p>}
              </div>
              <div className="colhd" style={{ marginTop: "16px" }}><span className="n">04</span><h3>SEO·GEO 정밀진단</h3><Grade ok={s.seo.ok} label="VENOM" /></div>
              {s.seo.ok ? (
                <>
                  <div className="seo">
                    <div className="score"><div className="big">{s.seo.score}</div><div className="small">/100 · {s.seo.grade}</div></div>
                    <div className="cats">
                      {s.seo.categories.slice(0, 4).map((c) => (
                        <div className="cat" key={c.label}>
                          <span className="cl">{c.label}</span><span className="cv">{c.pct}%</span>
                          <span className="ct"><span className="cf" style={{ width: `${c.pct}%`, background: c.pct >= 75 ? "var(--spd-good)" : c.pct >= 50 ? "var(--spd-watch)" : "var(--spd-risk)" }} /></span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {s.seo.topFixes.length > 0 && <p className="fixes"><b>우선순위</b> {s.seo.topFixes.slice(0, 3).map((f) => f.name).join(" · ")}</p>}
                </>
              ) : (
                <p className="sub">{s.seo.attempted ? `진단 실패(${s.seo.error ?? "접근 불가"})` : "홈페이지 URL 미입력 — 입력 시 SEO·GEO 실측."}</p>
              )}
            </div>
          </div>
          <div className="foot"><span className="src"><b>출처</b> 검색량·경쟁=네이버 검색광고 · 포화=네이버 블로그 · 진단=VENOM 엔진</span><span>전략 브리프</span></div>
        </div>
      </section>

      {/* ── P3 : 경쟁사·채널점유 | 의료광고 리스크 ── */}
      <section className="spd-sheet">
        <div className="spine"><div className="rail-dot" /><div className="rail-label">Strategy Brief · VENOM</div></div>
        <div className="body">
          <div className="runhead"><span className="doc">{doc}</span><span className="pg">전략 브리프</span></div>
          <div className="cols">
            <div>
              <div className="colhd"><span className="n">05</span><h3>경쟁사 상위 표본</h3><Grade ok={s.competitors.configured && s.competitors.places.length > 0} label="지역검색" /></div>
              <p className="sub">‘{label}’ · 자기병원 제외 · OpenAPI 상한 5곳</p>
              <table>
                <thead><tr><th style={{ width: "22px" }}>#</th><th>상호</th><th>분류</th></tr></thead>
                <tbody>
                  {s.competitors.places.slice(0, 5).map((p, i) => (
                    <tr key={p.name + i}><td className="num">{i + 1}</td><td className="kw">{p.name}</td><td>{p.category}</td></tr>
                  ))}
                  {s.competitors.places.length === 0 && <tr><td colSpan={3}>{s.competitors.configured ? "표본 없음" : "네이버 지역검색 미연동"}</td></tr>}
                </tbody>
              </table>
              <div className="colhd" style={{ marginTop: "15px" }}><span className="n">06</span><h3>채널 점유 · 본원 vs 경쟁</h3><Grade ok={s.sov.configured} label="실측" /></div>
              {s.sov.configured ? (
                <div className="sov">
                  {s.sov.channels.map((c) => {
                    const mine = c.topN > 0 ? Math.round((c.ownSlots / c.topN) * 100) : 0;
                    return (
                      <div className="sovrow" key={c.channel}>
                        <div className="sl"><span>{c.channel}</span><span className={`own ${c.ownSlots > 0 ? "" : "no"}`}>{c.ownSlots > 0 ? (c.ownRank ? `본원 ${c.ownRank}위` : `본원 상위 ${c.ownSlots}건`) : "본원 미노출"} · {c.topN}건 중 경쟁 {Math.max(0, c.topN - c.ownSlots)}</span></div>
                        <div className="stack2"><span className="mine" style={{ width: `${mine}%` }} /><span className="rival" style={{ width: `${100 - mine}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="sub">병원명 입력 시 본원 노출 실측.</p>}
            </div>
            <div>
              <div className="colhd"><span className="n">07</span><h3>의료광고 리스크 · §56</h3><span className="spd-tag soft">🟡 1차</span></div>
              <p className="sub">홈페이지 텍스트 위험 표현 자동 점검 — 심의 통과 보장 아님</p>
              {!s.compliance.scanned ? (
                <p className="sub">홈페이지 미스캔(URL 없음/접근 실패).</p>
              ) : s.compliance.high + s.compliance.medium === 0 ? (
                <div className="notice" style={{ borderColor: "var(--spd-good)", background: "color-mix(in srgb, var(--spd-good) 8%, #fff)" }}><b style={{ color: "var(--spd-good)" }}>✅ 위험 표현 미검출</b> (자동 1차). 최종 게시 전 내부·전문 검토는 별도 유지.</div>
              ) : (
                <div className="risklist">
                  {s.compliance.flags.slice(0, 6).map((f, i) => (
                    <div className="rk" key={i}><span className={`sev ${f.severity === "high" ? "h" : "m"}`}>{f.severity === "high" ? "높음" : "중간"}</span><span className="txt"><b>{f.label}</b> — <span>“{f.matched}”</span></span></div>
                  ))}
                </div>
              )}
              <div className="notice" style={{ marginTop: "12px" }}><b style={{ color: "var(--spd-brand)" }}>권고</b> — 전후사진·최상급·효과보장 표현은 의료법 §56 위반 소지가 높아 계약·심의 전 수정, 게시 전 검토 유지.</div>
            </div>
          </div>
          <div className="foot"><span className="src"><b>출처</b> 경쟁사·채널=네이버 지역검색·블로그 · 위험 스캔=홈페이지 1차 필터</span><span>전략 브리프</span></div>
        </div>
      </section>

      {/* ── P4 : 광고 예산(CPC 실측) ── */}
      <section className="spd-sheet">
        <div className="spine"><div className="rail-dot" /><div className="rail-label">Strategy Brief · VENOM</div></div>
        <div className="body">
          <div className="runhead"><span className="doc">{doc}</span><span className="pg">전략 브리프</span></div>
          <div className="colhd"><span className="n">08</span><h3>광고 예산 시나리오 · 파워링크</h3>{s.budget.bidConnected ? <Grade ok label="CPC 실측 입찰가" /> : <span className="spd-tag miss">⚪ 네이버 검색광고 미연결</span>}</div>
          {s.budget.bidConnected ? (
            <>
              <div className="cols w60">
                <div>
                  <p className="sub">네이버 검색광고 실측 입찰가 · 예산 = 월검색량 × 목표 CTR × CPC (추정 없음)</p>
                  <table>
                    <thead><tr><th>키워드</th><th className="num">월검색수</th><th>경쟁</th><th className="num">CPC(원, 실측)</th></tr></thead>
                    <tbody>
                      {s.budget.rows.map((r) => (
                        <tr key={r.keyword}><td className="kw">{r.keyword}</td><td className="num">{fmt(r.total)}</td><td><span className={`comp ${compClass(r.competition)}`}>{r.competition ?? "—"}</span></td><td className="num">{r.cpc == null ? "미조회" : fmt(r.cpc)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <div className="colhd"><span className="n">·</span><h3>월 예산 시나리오</h3></div>
                  <div className="scen">
                    {s.budget.scenarios.map((sc, i) => (
                      <div className={`scard ${i === 1 ? "mid" : ""}`} key={sc.label}><div className="sh">{sc.label}{i === 1 ? " · 권장" : ""}</div><div className="sv">{won(sc.monthlyWon)}<small> 만원/월</small></div><div className="sn">{sc.note}</div></div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="notice" style={{ borderColor: "var(--spd-good)", background: "color-mix(in srgb, var(--spd-good) 8%, #fff)", marginTop: "4px" }}>
                <b style={{ color: "var(--spd-good)" }}>✅ CPC 실측 원칙</b> — 표시 CPC는 네이버 검색광고 API의 평균노출 입찰가 실측치. 경쟁도 기반 추정치는 사용하지 않으며, 실측 입찰가를 확보하지 못한 키워드는 예산 산출에서 제외{s.budget.measuredCount < s.budget.rows.length ? `(실측 ${s.budget.measuredCount}개 키워드 기준)` : ""}. 예산은 실집행 전 참고치(목표 CTR 가정).
              </div>
            </>
          ) : (
            <>
              <table>
                <thead><tr><th>키워드</th><th className="num">월검색수</th><th>경쟁</th></tr></thead>
                <tbody>{s.budget.rows.map((r) => (<tr key={r.keyword}><td className="kw">{r.keyword}</td><td className="num">{fmt(r.total)}</td><td><span className={`comp ${compClass(r.competition)}`}>{r.competition ?? "—"}</span></td></tr>))}</tbody>
              </table>
              <div className="notice" style={{ marginTop: "12px" }}><b style={{ color: "var(--spd-watch)" }}>예산 시나리오 미산출</b> — 네이버 검색광고 API 미연결로 CPC 실측 입찰가를 확보하지 못했습니다. <b>추정치는 사용하지 않습니다.</b> NAVER_AD 키 연결 시 실측 입찰가 기반 예산이 자동 산출됩니다.</div>
            </>
          )}
          <div className="foot"><span className="src"><b>출처</b> CPC·검색수 = 네이버 검색광고 실측 입찰가/검색량 API</span><span>전략 브리프</span></div>
        </div>
      </section>

      {/* ── P5 : 데이터 출처·고지 ── */}
      <section className="spd-sheet">
        <div className="spine"><div className="rail-dot" /><div className="rail-label">Strategy Brief · VENOM</div></div>
        <div className="body">
          <div className="runhead"><span className="doc">{doc}</span><span className="pg">전략 브리프</span></div>
          <div className="colhd"><span className="n">09</span><h3>데이터 출처 · 고지</h3></div>
          {(() => {
            const measured: string[] = [];
            const missing: string[] = [];
            (s.keywords.searchConnected ? measured : missing).push("키워드 검색량·경쟁(네이버 검색광고)");
            (s.budget.bidConnected ? measured : missing).push("파워링크 CPC 입찰가(네이버 검색광고)");
            (s.competitors.places.length ? measured : missing).push("경쟁사 상위 표본(네이버 지역검색)");
            (s.seo.ok ? measured : missing).push("홈페이지 SEO·GEO 정밀진단(VENOM 엔진)");
            (s.compliance.scanned ? measured : missing).push("의료광고 위험 표현 스캔(홈페이지)");
            (s.sov.configured ? measured : missing).push("채널 점유율(본원 vs 경쟁)");
            return (
              <div className="legend">
                <div className="leg"><div className="lt g">✅ 실측</div><div className="lb">{measured.length ? measured.join(" · ") : "—"}</div></div>
                <div className="leg"><div className="lt w">🟡 정성</div><div className="lb">수주 진단 단계·대응 방향·검색여정 퍼널 메시지 — 실측 지표 기반 규칙형 해석.</div></div>
                <div className="leg"><div className="lt r">⚪ 미연결</div><div className="lb">{missing.length ? missing.join(" · ") : "없음(주요 소스 연결됨)"}</div></div>
              </div>
            );
          })()}
          <div className="notice" style={{ marginTop: "14px" }}><b style={{ color: "var(--spd-brand)" }}>고지</b> — 본 제안의 성과 수치는 <b>목표치이며 보장이 아닙니다.</b> CPC는 네이버 검색광고 실측 입찰가만 사용(추정 금지). 경쟁사는 지역검색 OpenAPI 상한(최대 5) 표본. 위험 표현 스캔은 1차 자동 필터로 <b>의료법 §56</b> 심의 통과를 보장하지 않으며, 전후사진·최상급·효과보장 표현은 게시 전 수정 권고.</div>
          <div className="signoff"><div className="brand">VENOM &amp; MARKEPICK</div><div className="tagline">분석 → 제안 → 진행 → 보고 · 실측 기반 전략을 월 단위로 실행·측정·최적화</div></div>
          <div className="foot"><span className="src"><b>생성</b> VENOM ERP · /strategy · {today}</span><span>전략 브리프</span></div>
        </div>
      </section>
    </div>
  );
}

const CSS = `
.venom-spd{ --spd-paper:#fbfaf8; --spd-edge:#fff; --spd-ink:#1a1c20; --spd-ink-soft:#4a453f; --spd-muted:#837b72;
  --spd-line:#e7e1db; --spd-line-strong:#d8d0c6; --spd-brand:#d9662e; --spd-brand-strong:#c2560f; --spd-wash:#fbeadd;
  --spd-cover:#17140f; --spd-good:#0f8a5f; --spd-watch:#b7791f; --spd-risk:#d14343;
  --spd-sans:"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",system-ui,-apple-system,sans-serif;
  font-family:var(--spd-sans); color:var(--spd-ink); line-height:1.5; }
@media screen{ .venom-spd{ display:none; } }
.venom-spd .spd-sheet{ background:var(--spd-paper); position:relative; overflow:hidden; display:grid; grid-template-columns:12mm 1fr; }
.venom-spd[data-orient="landscape"] .spd-sheet{ width:297mm; min-height:210mm; }
.venom-spd[data-orient="portrait"] .spd-sheet{ width:210mm; min-height:297mm; }
.venom-spd .spine{ background:linear-gradient(180deg,var(--spd-brand),var(--spd-brand-strong)); position:relative; color:#fff; }
.venom-spd .rail-label{ position:absolute; bottom:14mm; left:50%; transform:translateX(-50%) rotate(180deg); writing-mode:vertical-rl; font-size:8pt; letter-spacing:.32em; font-weight:700; text-transform:uppercase; opacity:.95; }
.venom-spd .rail-dot{ position:absolute; top:12mm; left:50%; transform:translateX(-50%); width:5mm; height:5mm; border-radius:50%; background:#fff; }
.venom-spd .body{ padding:11mm 14mm 14mm 12mm; position:relative; display:flex; flex-direction:column; }
.venom-spd .body>*{ position:relative; z-index:1; }
.venom-spd .runhead{ display:flex; align-items:baseline; justify-content:space-between; border-bottom:1px solid var(--spd-line); padding-bottom:6px; margin-bottom:12px; }
.venom-spd .runhead .doc{ font-size:8.5pt; letter-spacing:.04em; color:var(--spd-muted); font-weight:700; }
.venom-spd .runhead .pg{ font-size:8pt; color:var(--spd-muted); text-transform:uppercase; letter-spacing:.08em; }
.venom-spd .cols{ display:grid; grid-template-columns:1fr 1fr; gap:13mm; align-items:start; flex:1; }
.venom-spd .cols.w60{ grid-template-columns:1.25fr .75fr; }
.venom-spd[data-orient="portrait"] .cols{ grid-template-columns:1fr; gap:8mm; }
.venom-spd .colhd{ display:flex; align-items:baseline; gap:8px; border-bottom:2px solid var(--spd-brand); padding-bottom:5px; margin-bottom:11px; }
.venom-spd .colhd .n{ font-size:15pt; font-weight:800; color:var(--spd-brand); line-height:1; letter-spacing:-.02em; }
.venom-spd .colhd h3{ margin:0; font-size:11.5pt; font-weight:800; color:var(--spd-ink); }
.venom-spd .spd-tag{ display:inline-flex; align-items:center; gap:4px; font-size:7.5pt; font-weight:700; padding:2px 7px; border-radius:999px; }
.venom-spd .colhd .spd-tag{ margin-left:auto; }
.venom-spd .spd-tag.live{ color:var(--spd-good); background:color-mix(in srgb,var(--spd-good) 12%,#fff); }
.venom-spd .spd-tag.soft{ color:var(--spd-watch); background:color-mix(in srgb,var(--spd-watch) 14%,#fff); }
.venom-spd .spd-tag.miss{ color:var(--spd-muted); background:color-mix(in srgb,var(--spd-muted) 12%,#fff); }
.venom-spd .sub{ font-size:8.5pt; color:var(--spd-muted); margin:0 0 9px; }
.venom-spd p{ margin:0 0 8px; }
.venom-spd .kpis{ display:grid; grid-template-columns:repeat(4,1fr); gap:9px; margin-bottom:12px; }
.venom-spd .kpi{ border:1px solid var(--spd-line); border-radius:10px; padding:12px 13px; background:var(--spd-edge); position:relative; }
.venom-spd .kpi::before{ content:""; position:absolute; top:12px; left:0; width:3px; height:22px; background:var(--spd-brand); border-radius:0 2px 2px 0; }
.venom-spd .kpi .v{ font-size:23pt; font-weight:800; letter-spacing:-.02em; line-height:1; font-variant-numeric:tabular-nums; }
.venom-spd .kpi .v small{ font-size:11pt; font-weight:700; color:var(--spd-muted); }
.venom-spd .kpi .k{ font-size:8pt; color:var(--spd-muted); margin-top:7px; }
.venom-spd .verdict{ display:grid; grid-template-columns:auto 1fr; gap:12px; align-items:center; padding:12px 14px; border:1px solid var(--spd-brand); border-radius:10px; background:color-mix(in srgb,var(--spd-wash) 60%,#fff); }
.venom-spd .verdict .badge{ font-size:8.5pt; font-weight:800; color:#fff; background:var(--spd-brand); padding:5px 10px; border-radius:7px; white-space:nowrap; }
.venom-spd .verdict p{ margin:0; font-size:9.5pt; }
.venom-spd .actions{ display:flex; flex-direction:column; gap:8px; margin-top:12px; }
.venom-spd .actions .a{ font-size:9pt; color:var(--spd-ink-soft); }
.venom-spd .actions .a b{ color:var(--spd-brand); }
.venom-spd table{ width:100%; border-collapse:collapse; font-size:8.5pt; }
.venom-spd thead th{ text-align:left; font-weight:700; color:var(--spd-muted); font-size:7.5pt; text-transform:uppercase; letter-spacing:.03em; padding:5px 7px; border-bottom:1.5px solid var(--spd-line-strong); }
.venom-spd tbody td{ padding:6px 7px; border-bottom:1px solid var(--spd-line); }
.venom-spd tbody tr:last-child td{ border-bottom:0; }
.venom-spd td.num,.venom-spd th.num{ text-align:right; font-variant-numeric:tabular-nums; }
.venom-spd td.kw{ font-weight:600; }
.venom-spd .comp{ font-size:7pt; font-weight:700; padding:1px 6px; border-radius:5px; }
.venom-spd .comp.hi{ color:var(--spd-risk); background:color-mix(in srgb,var(--spd-risk) 10%,#fff); }
.venom-spd .comp.mid{ color:var(--spd-watch); background:color-mix(in srgb,var(--spd-watch) 12%,#fff); }
.venom-spd .comp.lo{ color:var(--spd-good); background:color-mix(in srgb,var(--spd-good) 12%,#fff); }
.venom-spd .bars{ display:flex; flex-direction:column; gap:7px; }
.venom-spd .bar{ display:grid; grid-template-columns:84px 1fr 50px; align-items:center; gap:9px; font-size:8pt; }
.venom-spd .bar .lab{ color:var(--spd-ink-soft); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.venom-spd .bar .track{ height:9px; background:color-mix(in srgb,var(--spd-line) 70%,#fff); border-radius:5px; overflow:hidden; }
.venom-spd .bar .fill{ height:100%; border-radius:5px; background:linear-gradient(90deg,var(--spd-brand),var(--spd-brand-strong)); }
.venom-spd .bar .val{ text-align:right; font-variant-numeric:tabular-nums; font-weight:600; }
.venom-spd .funnel{ display:flex; flex-direction:column; gap:9px; }
.venom-spd .fcard{ border:1px solid var(--spd-line); border-left:3px solid var(--spd-brand); border-radius:9px; padding:9px 12px; background:var(--spd-edge); display:grid; grid-template-columns:auto 1fr auto; gap:11px; align-items:center; }
.venom-spd .fcard .fh{ font-size:11pt; font-weight:800; color:var(--spd-brand); }
.venom-spd .fcard .fmid .fg{ font-size:9pt; font-weight:800; }
.venom-spd .fcard .fmid .fm{ font-size:7.8pt; color:var(--spd-muted); line-height:1.4; }
.venom-spd .fcard .fk{ font-size:7.5pt; color:var(--spd-ink-soft); text-align:right; white-space:nowrap; }
.venom-spd .seo{ display:flex; align-items:center; gap:14px; margin-bottom:9px; }
.venom-spd .seo .score{ text-align:center; }
.venom-spd .seo .big{ font-size:28pt; font-weight:800; color:var(--spd-brand); line-height:.9; font-variant-numeric:tabular-nums; }
.venom-spd .seo .small{ font-size:8pt; color:var(--spd-muted); font-weight:700; }
.venom-spd .cats{ display:grid; grid-template-columns:1fr 1fr; gap:7px 18px; flex:1; }
.venom-spd .cat{ display:grid; grid-template-columns:1fr 40px; align-items:center; gap:8px; font-size:8pt; }
.venom-spd .cat .ct{ height:7px; background:color-mix(in srgb,var(--spd-line) 70%,#fff); border-radius:4px; overflow:hidden; grid-column:1/-1; margin-top:2px; }
.venom-spd .cat .cf{ height:100%; border-radius:4px; }
.venom-spd .cat .cl{ color:var(--spd-ink-soft); } .venom-spd .cat .cv{ text-align:right; font-variant-numeric:tabular-nums; font-weight:700; }
.venom-spd .fixes{ font-size:8pt; color:var(--spd-ink-soft); }
.venom-spd .sov{ display:flex; flex-direction:column; gap:9px; }
.venom-spd .sovrow .sl{ display:flex; justify-content:space-between; font-size:8pt; margin-bottom:4px; gap:8px; }
.venom-spd .sovrow .sl .own{ color:var(--spd-brand); font-weight:700; text-align:right; } .venom-spd .sovrow .sl .own.no{ color:var(--spd-muted); }
.venom-spd .stack2{ height:12px; border-radius:6px; overflow:hidden; display:flex; background:color-mix(in srgb,var(--spd-line) 60%,#fff); }
.venom-spd .stack2 .mine{ background:var(--spd-brand); } .venom-spd .stack2 .rival{ background:var(--spd-line-strong); }
.venom-spd .risklist{ display:flex; flex-direction:column; gap:6px; }
.venom-spd .rk{ display:grid; grid-template-columns:auto 1fr; gap:9px; font-size:8pt; padding:6px 10px; border-radius:7px; background:var(--spd-edge); border:1px solid var(--spd-line); align-items:center; }
.venom-spd .rk .sev{ font-size:7pt; font-weight:800; padding:1px 7px; border-radius:5px; white-space:nowrap; }
.venom-spd .rk .sev.h{ color:#fff; background:var(--spd-risk); } .venom-spd .rk .sev.m{ color:#fff; background:var(--spd-watch); }
.venom-spd .rk .txt b{ color:var(--spd-ink); } .venom-spd .rk .txt span{ color:var(--spd-muted); }
.venom-spd .scen{ display:grid; grid-template-columns:1fr; gap:9px; }
.venom-spd .scard{ border:1px solid var(--spd-line); border-radius:10px; padding:11px 13px; background:var(--spd-edge); }
.venom-spd .scard.mid{ border-color:var(--spd-brand); background:color-mix(in srgb,var(--spd-wash) 45%,#fff); }
.venom-spd .scard .sh{ font-size:8pt; font-weight:800; color:var(--spd-brand); text-transform:uppercase; letter-spacing:.04em; }
.venom-spd .scard .sv{ font-size:18pt; font-weight:800; font-variant-numeric:tabular-nums; margin-top:3px; }
.venom-spd .scard .sv small{ font-size:9pt; color:var(--spd-muted); font-weight:700; }
.venom-spd .scard .sn{ font-size:7.5pt; color:var(--spd-muted); margin-top:5px; line-height:1.4; }
.venom-spd .notice{ padding:11px 13px; border-radius:9px; background:color-mix(in srgb,var(--spd-wash) 40%,#fff); border:1px solid var(--spd-brand); font-size:8pt; color:var(--spd-ink-soft); line-height:1.5; }
.venom-spd .legend{ display:flex; flex-direction:column; gap:9px; }
.venom-spd .leg{ display:grid; grid-template-columns:70px 1fr; gap:12px; padding:10px 12px; border:1px solid var(--spd-line); border-radius:9px; background:var(--spd-edge); }
.venom-spd .leg .lt{ font-size:8.5pt; font-weight:800; }
.venom-spd .leg .lt.g{ color:var(--spd-good); } .venom-spd .leg .lt.w{ color:var(--spd-watch); } .venom-spd .leg .lt.r{ color:var(--spd-muted); }
.venom-spd .leg .lb{ font-size:8pt; color:var(--spd-ink-soft); line-height:1.5; }
.venom-spd .signoff{ margin-top:auto; text-align:center; padding-top:16mm; }
.venom-spd .signoff .brand{ font-size:13pt; font-weight:800; letter-spacing:.22em; color:var(--spd-brand); }
.venom-spd .signoff .tagline{ font-size:8.5pt; color:var(--spd-muted); margin-top:6px; }
.venom-spd .foot{ position:absolute; left:12mm; right:14mm; bottom:7mm; display:flex; justify-content:space-between; align-items:center; font-size:7.5pt; color:var(--spd-muted); border-top:1px solid var(--spd-line); padding-top:5px; }
.venom-spd .foot .src b{ color:var(--spd-ink-soft); font-weight:700; }
.venom-spd .cover{ grid-template-columns:1fr; background:var(--spd-cover); color:#fff; }
.venom-spd .cover-in{ padding:22mm 26mm 16mm; display:grid; grid-template-columns:1.1fr .9fr; gap:16mm; min-height:inherit; position:relative; align-items:center; }
.venom-spd[data-orient="portrait"] .cover-in{ grid-template-columns:1fr; align-content:center; gap:10mm; }
.venom-spd .cover-in::after{ content:""; position:absolute; left:0; top:0; width:10mm; height:100%; background:linear-gradient(180deg,var(--spd-brand),var(--spd-brand-strong)); }
.venom-spd .cover-in>.left,.venom-spd .cover-in>.right{ position:relative; z-index:1; }
.venom-spd .cover .kicker{ font-size:11pt; font-weight:800; letter-spacing:.28em; color:var(--spd-brand); text-transform:uppercase; }
.venom-spd .cover .client{ font-size:14pt; color:#cfc7bd; margin-top:14px; font-weight:600; }
.venom-spd .cover h1{ font-size:42pt; font-weight:800; letter-spacing:-.025em; line-height:1; margin:6px 0 0; }
.venom-spd .cover .meta{ font-size:12pt; color:#cfc7bd; margin-top:16px; }
.venom-spd .cover .right{ border-left:1px solid rgba(255,255,255,.16); padding-left:16mm; }
.venom-spd[data-orient="portrait"] .cover .right{ border-left:0; padding-left:0; border-top:1px solid rgba(255,255,255,.16); padding-top:12mm; }
.venom-spd .cover .chips{ display:flex; flex-wrap:wrap; gap:7px; }
.venom-spd .cover .chip{ font-size:8.5pt; color:#e8e0d6; border:1px solid rgba(255,255,255,.22); border-radius:999px; padding:4px 11px; }
.venom-spd .cover .foot2{ font-size:8.5pt; color:#8f877d; line-height:1.55; margin-top:20px; border-top:1px solid rgba(255,255,255,.14); padding-top:12px; }
.venom-spd .cover .foot2 b{ color:#d8cfc4; }
@media print{
  body *{ visibility:hidden !important; }
  .venom-spd, .venom-spd *{ visibility:visible !important; }
  .venom-spd{ display:block !important; position:absolute; left:0; top:0; width:100%; }
  .venom-spd .spd-sheet{ break-after:page; box-shadow:none; }
  .venom-spd .spd-sheet:last-child{ break-after:auto; }
}
`;
