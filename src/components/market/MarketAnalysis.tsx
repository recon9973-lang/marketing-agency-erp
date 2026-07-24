"use client";

/**
 * 상권분석 — 지역(주소/구) + 진료과 입력 → 실측 인사이트(① 인구·성별 ② 병원 밀집도 ③ 진료과 수요).
 * 데이터: 행안부 주민등록(2026.6) · 심평원 병원정보/상병통계. 모두 ✅실측.
 */
import { useState, useTransition } from "react";
import { analyzeRegion, generateMarketReport, generateProposal, analyzeRadius, searchCompetitors, type RegionAnalysis } from "@/server/actions/region";
import type { FacilityRadius } from "@/server/data/region-insight";
import type { LocalPlace } from "@/server/integrations/naver-local";
import { downloadMarketDeck } from "@/components/market/deck";

// 주요 KCD 3단위 상병코드 라벨(표준). 없는 코드는 코드 그대로 표기(날조 금지).
const KCD: Record<string, string> = {
  A09: "감염성 위장염", B01: "수두", E03: "갑상선기능저하", E11: "2형 당뇨", E66: "비만",
  E78: "고지혈증", E87: "수분·전해질 이상", F32: "우울에피소드", F41: "불안장애", G43: "편두통",
  H10: "결막염", H25: "노년백내장", H61: "귀지·외이질환", I10: "고혈압", J00: "감기(급성비인두염)",
  J01: "급성부비동염", J02: "급성인두염", J03: "급성편도염", J20: "급성기관지염", J30: "혈관운동성비염",
  J45: "천식", K02: "치아우식(충치)", K04: "치수·치근질환", K05: "치은·치주질환", K08: "치아·지지구조 이상",
  K21: "위식도역류", K29: "위염·십이지장염", K30: "소화불량", L20: "아토피피부염", L21: "지루피부염",
  L23: "알레르기접촉피부염", L30: "기타 피부염", L50: "두드러기", L70: "여드름", M25: "관절통",
  M54: "등·허리통증", M75: "어깨병변", M79: "연조직질환", N39: "요로계질환", R05: "기침",
  R51: "두통", S93: "발목·발 염좌", Z00: "일반건강검진", Z01: "특수검사"
};

function fmt(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("ko-KR");
}

const CARD = "rounded-2xl border border-line bg-card p-4";
// 심평원 표시과목별 상병통계의 진료과(양방 26종) + 한방(수요통계는 양방만 → ③ 미제공, 경쟁/밀집도는 정상)
const SPECIALTIES = [
  "", "내과", "정형외과", "성형외과", "피부과", "이비인후과", "안과", "산부인과", "소아청소년과",
  "치과", "정신건강의학과", "재활의학과", "비뇨의학과", "가정의학과", "신경과", "외과", "마취통증의학과",
  "한의원", "한방병원"
];
const ORIENTAL = new Set(["한의원", "한방병원", "한방"]);

export function MarketAnalysis({ presetRegion = "", presetSpecialty = "" }: { presetRegion?: string; presetSpecialty?: string }) {
  const [region, setRegion] = useState(presetRegion);
  const [specialty, setSpecialty] = useState(presetSpecialty);
  const [brand, setBrand] = useState("");
  const [res, setRes] = useState<RegionAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [report, setReport] = useState<string | null>(null);
  const [reportKind, setReportKind] = useState<"리포트" | "제안서">("리포트");
  const [reportPending, startReport] = useTransition();
  const [radiusKm, setRadiusKm] = useState(1);
  const [radiusRes, setRadiusRes] = useState<FacilityRadius | null>(null);
  const [radiusPending, startRadius] = useTransition();
  const [pptBusy, setPptBusy] = useState(false);
  const [comp, setComp] = useState<{ configured: boolean; query: string; places: LocalPlace[]; filtered: boolean } | null>(null);
  const [compPending, startComp] = useTransition();

  function run(regionOverride?: string) {
    const q = (regionOverride ?? region).trim();
    if (!q) return;
    setError(null);
    setReport(null);
    setRadiusRes(null);
    setComp(null);
    start(async () => {
      const r = await analyzeRegion({ region: q, specialty: specialty || null });
      if (r.ok) setRes(r.data);
      else setError(r.error.message);
    });
  }

  function runRadius(km?: number, nameOverride?: string) {
    if (!res?.resolve.key) return;
    const nm = (nameOverride ?? brand).trim();
    if (!nm) {
      setError("반경 밀집도는 업체명이 필요합니다(위 '업체명'에 병원명 입력).");
      return;
    }
    const k = km ?? radiusKm;
    setRadiusKm(k);
    setError(null);
    startRadius(async () => {
      const r = await analyzeRadius({ region: res.resolve.label, name: nm, radiusKm: k });
      if (r.ok) setRadiusRes(r.data);
      else setError(r.error.message);
    });
  }

  function makeReport(kind: "리포트" | "제안서") {
    if (!res?.resolve.key) return;
    setReportKind(kind);
    startReport(async () => {
      const args = { region: res.resolve.label, specialty: specialty || null, brand: brand || null };
      const r = kind === "제안서" ? await generateProposal(args) : await generateMarketReport(args);
      if (r.ok && r.data.ok) setReport(r.data.markdown);
      else setError(r.ok ? r.data.note ?? "생성 실패" : r.error.message);
    });
  }

  function runComp() {
    if (!res?.resolve.key) return;
    setError(null);
    startComp(async () => {
      const r = await searchCompetitors({ region: res.resolve.label, specialty: specialty || null });
      if (r.ok) setComp(r.data);
      else setError(r.error.message);
    });
  }

  async function makeDeck() {
    if (!res?.resolve.key) return;
    setPptBusy(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await downloadMarketDeck({ analysis: res, brand, radius: radiusRes, today });
    } catch {
      setError("PPT 생성 중 오류가 발생했습니다.");
    } finally {
      setPptBusy(false);
    }
  }

  function downloadReport() {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportKind === "제안서" ? "제안서" : "상권분석"}_${res?.resolve.label ?? ""}${specialty ? `_${specialty}` : ""}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pop = res?.population;
  const hos = res?.hospitals;
  const counts = hos?.counts ?? {};
  const maxCount = Math.max(1, ...Object.values(counts));
  const maxPatients = Math.max(1, ...(res?.demand ?? []).map((d) => d.patients));

  return (
    <div className="space-y-4">
      {/* 입력 */}
      <div className={CARD}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[200px] text-xs font-semibold text-slate-600 dark:text-slate-300">
            지역 (주소 또는 구/시군구)
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !(e.nativeEvent.isComposing || e.keyCode === 229)) run();
              }}
              placeholder="예: 대구 달서구 / 서울 강남구 / 광주 북구"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-400"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            진료과 (수요 조회)
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="mt-1 block rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-400"
            >
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {s || "선택 안 함"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            업체명 (선택 · 리포트용)
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="예: OO의원"
              className="mt-1 block w-36 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-400"
            />
          </label>
          <button
            onClick={() => run()}
            disabled={pending || !region.trim()}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? "조회 중…" : "상권 조회"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          행안부 주민등록(2026.6) · 심평원 병원정보·상병통계 <span className="font-semibold text-emerald-600">✅실측</span>
        </p>
      </div>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}

      {/* 모호 지역 후보 */}
      {res && !res.resolve.key && res.resolve.candidates.length > 0 && (
        <div className={CARD}>
          <p className="mb-2 text-sm font-semibold text-ink">여러 지역이 일치합니다 — 선택하세요</p>
          <div className="flex flex-wrap gap-2">
            {res.resolve.candidates.map((c) => (
              <button
                key={c.key}
                onClick={() => { setRegion(c.label); run(c.label); }}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 미해결 */}
      {res && !res.resolve.key && res.resolve.candidates.length === 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          &lsquo;{res.resolve.label}&rsquo; 지역을 찾지 못했습니다. 시/도를 붙여 다시 입력해보세요 (예: &lsquo;부산 해운대구&rsquo;).
        </p>
      )}

      {/* 결과 */}
      {res?.resolve.key && (
        <>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-ink">{res.resolve.label}</h2>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300">실측</span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* ① 인구 */}
            <div className={CARD}>
              <h3 className="mb-3 text-sm font-bold text-ink">① 인구 · 성별 <span className="font-normal text-slate-400">행안부 주민등록</span></h3>
              {pop ? (
                <div className="space-y-3">
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-ink">{fmt(pop.total)}</span>
                    <span className="pb-1 text-xs text-slate-500">명 · {pop.dongs}개 행정동</span>
                    {pop.delta !== 0 && (
                      <span className={`pb-1 text-xs font-semibold ${pop.delta > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                        {pop.delta > 0 ? "▲" : "▼"} {fmt(Math.abs(pop.delta))} (전월)
                      </span>
                    )}
                  </div>
                  {/* 성비 막대 */}
                  <div>
                    <div className="flex h-6 overflow-hidden rounded-lg text-[10px] font-bold text-white">
                      <div className="flex items-center justify-center bg-sky-500" style={{ width: `${pop.total ? (pop.male / pop.total) * 100 : 50}%` }}>
                        남 {pop.total ? Math.round((pop.male / pop.total) * 100) : 0}%
                      </div>
                      <div className="flex items-center justify-center bg-rose-400" style={{ width: `${pop.total ? (pop.female / pop.total) * 100 : 50}%` }}>
                        여 {pop.femaleRatio ?? "—"}%
                      </div>
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                      <span>남 {fmt(pop.male)}</span>
                      <span>여 {fmt(pop.female)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">인구 데이터 없음</p>
              )}
            </div>

            {/* ② 병원 밀집도 */}
            <div className={CARD}>
              <h3 className="mb-3 text-sm font-bold text-ink">② 병원 밀집도 · 종별 <span className="font-normal text-slate-400">심평원</span></h3>
              {hos ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                    {[
                      { k: "전체", v: hos.total },
                      { k: "의원", v: hos.clinic },
                      { k: "치과의원", v: hos.dental },
                      { k: "한의원", v: hos.oriental }
                    ].map((c) => (
                      <div key={c.k} className="rounded-xl border border-line bg-surface/50 p-2">
                        <div className="text-lg font-bold text-ink">{fmt(c.v)}</div>
                        <div className="text-[10px] text-slate-500">{c.k}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                    <span>병원급 <b className="text-ink">{fmt(hos.hospitalGrade)}</b></span>
                    {hos.clinicToOriental != null && <span>의원:한의원 <b className="text-ink">{hos.clinicToOriental}:1</b></span>}
                    {hos.perTenThousand != null && <span>만명당 <b className="text-ink">{hos.perTenThousand}</b>개</span>}
                  </div>
                  {/* 종별 전체 막대 */}
                  <div className="space-y-1">
                    {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([type, n]) => (
                      <div key={type} className="flex items-center gap-2 text-[11px]">
                        <span className="w-16 shrink-0 text-right text-slate-500">{type}</span>
                        <div className="h-3 flex-1 overflow-hidden rounded bg-surface">
                          <div className="h-full rounded bg-emerald-500" style={{ width: `${(n / maxCount) * 100}%` }} />
                        </div>
                        <span className="w-10 shrink-0 font-semibold text-ink">{fmt(n)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">병원 데이터 없음</p>
              )}
            </div>
          </div>

          {/* ③ 진료과 수요 */}
          {res.specialty ? (
            <div className={CARD}>
              <h3 className="mb-1 text-sm font-bold text-ink">
                ③ {res.specialty} 수요 — 주상병 상위 <span className="font-normal text-slate-400">심평원 표시과목별 상병통계(2025, 전국)</span>
              </h3>
              <p className="mb-3 text-[11px] text-slate-500">전국 {res.specialty} 의원의 주상병별 연간 환자수 — 실수요 구조(지역 아님).</p>
              {res.demand.length > 0 ? (
                <div className="space-y-1">
                  {res.demand.slice(0, 12).map((d) => (
                    <div key={d.code} className="flex items-center gap-2 text-[11px]">
                      <span className="w-40 shrink-0 truncate text-slate-600 dark:text-slate-300" title={d.code}>
                        <b className="text-ink">{d.code}</b> {KCD[d.code] ?? ""}
                      </span>
                      <div className="h-3 flex-1 overflow-hidden rounded bg-surface">
                        <div className="h-full rounded bg-sky-500" style={{ width: `${(d.patients / maxPatients) * 100}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right font-semibold text-ink">{fmt(d.patients)}</span>
                    </div>
                  ))}
                </div>
              ) : ORIENTAL.has(res.specialty) ? (
                <p className="text-sm text-amber-600">한방(한의원·한방병원)은 심평원 <b>양방 표시과목</b> 상병통계에 없어 ③ 수요는 제공되지 않습니다. ① 인구·② 밀집도·경쟁사는 정상입니다.</p>
              ) : (
                <p className="text-sm text-slate-400">해당 진료과 수요 데이터 없음</p>
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-3 text-center text-[11px] text-slate-500">
              위에서 진료과를 선택하면 ③ 해당 과의 주상병 실수요(전국)를 함께 보여줍니다.
            </p>
          )}

          {/* 경쟁사 상위 (네이버 지역검색) */}
          <div className={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-ink">🏥 경쟁사 상위 <span className="font-normal text-slate-400">네이버 지역검색</span></h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  기준: 네이버 지역검색 &lsquo;{res.resolve.label} {specialty}&rsquo; · 리뷰·언급 많은 순 · 최대 5(표본, 개수 아님)
                  {specialty && <span className="text-emerald-600"> · {specialty} 동종만</span>}
                </p>
              </div>
              <button
                onClick={runComp}
                disabled={compPending}
                className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 disabled:opacity-50 dark:text-slate-200"
              >
                {compPending ? "조회 중…" : "경쟁사 조회"}
              </button>
            </div>
            {comp && !comp.configured && (
              <p className="mt-3 text-[11px] text-amber-600">
                네이버 지역검색 미연결 — <code>NAVER_CLIENT_ID/SECRET</code> 설정 시 실측 표본이 나옵니다.
              </p>
            )}
            {comp?.configured && comp.places.length === 0 && (
              <p className="mt-3 text-[11px] text-slate-500">&lsquo;{comp.query}&rsquo; 결과가 없습니다.</p>
            )}
            {comp && comp.places.length > 0 && (
              <div className="mt-3 space-y-2">
                {comp.places.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl border border-line bg-surface/40 p-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {p.link ? <a href={p.link} target="_blank" rel="noreferrer" className="hover:underline">{p.name}</a> : p.name}
                        {p.category && <span className="ml-1.5 text-[10px] font-normal text-slate-400">{p.category}</span>}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">{p.roadAddress || p.address}{p.telephone ? ` · ${p.telephone}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 반경 밀집도 (#1) */}
          <div className={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-ink">📍 반경 밀집도 <span className="font-normal text-slate-400">업체 좌표 기준</span></h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  업체명이 병원 목록에 있으면 좌표를 찾아 반경 내 <b>동종 경쟁</b>·전체 병·의원을 실측합니다(지오코딩 불필요).
                </p>
              </div>
              <div className="flex gap-1">
                {[1, 3].map((k) => (
                  <button
                    key={k}
                    onClick={() => runRadius(k)}
                    disabled={radiusPending}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                      radiusKm === k && radiusRes ? "border-emerald-600 bg-emerald-600 text-white" : "border-line bg-surface text-slate-600 hover:border-emerald-300"
                    }`}
                  >
                    {radiusPending && radiusKm === k ? "…" : `반경 ${k}km`}
                  </button>
                ))}
              </div>
            </div>

            {radiusRes && radiusRes.candidates.length > 1 && (
              <div className="mt-3">
                <p className="mb-1 text-[11px] text-slate-500">여러 곳이 일치합니다 — 대상 선택:</p>
                <div className="flex flex-wrap gap-1.5">
                  {radiusRes.candidates.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => runRadius(radiusKm, c.name)}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      {c.name} <span className="text-slate-400">({c.type})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {radiusRes?.facility && radiusRes.all && radiusRes.sameType && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  기준: <b className="text-ink">{radiusRes.facility.name}</b> <span className="text-slate-400">({radiusRes.facility.type})</span> · 반경 {radiusRes.radiusKm}km
                </p>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800/50 dark:bg-emerald-950/30">
                    <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{fmt(radiusRes.sameType.total)}</div>
                    <div className="text-[10px] text-slate-500">동종({radiusRes.facility.type}) 경쟁</div>
                  </div>
                  <div className="rounded-xl border border-line bg-surface/50 p-3">
                    <div className="text-2xl font-bold text-ink">{fmt(radiusRes.all.total)}</div>
                    <div className="text-[10px] text-slate-500">전체 병·의원</div>
                  </div>
                </div>
                {radiusRes.sameType.nearest.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-500">가까운 동종 경쟁 (거리순)</p>
                    <div className="max-h-40 space-y-0.5 overflow-auto">
                      {radiusRes.sameType.nearest.slice(0, 10).map((n, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                          <span className="truncate text-slate-600 dark:text-slate-300">{n.name}</span>
                          <span className="shrink-0 text-slate-400">{n.distanceKm}km</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {radiusRes && !radiusRes.facility && radiusRes.candidates.length === 0 && (
              <p className="mt-3 text-[11px] text-amber-600">
                {radiusRes.available
                  ? `'${brand}'을(를) ${res.resolve.label} 병원 목록에서 찾지 못했습니다. 정확한 병원명을 입력하세요.`
                  : "좌표 데이터가 로드되지 않았습니다(배포 환경 파일 미포함). 잠시 후 다시 시도하세요."}
              </p>
            )}
            {!radiusRes && !brand && (
              <p className="mt-3 text-[11px] text-slate-500">위 &lsquo;업체명&rsquo;에 병원명을 넣고 반경 버튼을 누르세요.</p>
            )}
          </div>

          {/* 리포트 생성 (#3) */}
          <div className={CARD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-ink">📄 문서 생성 {report && <span className="text-emerald-600">· {reportKind}</span>}</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">위 실측 데이터로 상권분석 리포트·마케팅 제안서(마크다운)를 즉시 작성 — 3등급 출처·의료광고법 준수.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => makeReport("리포트")}
                  disabled={reportPending}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-700"
                >
                  {reportPending && reportKind === "리포트" ? "작성 중…" : "상권 리포트"}
                </button>
                <button
                  onClick={() => makeReport("제안서")}
                  disabled={reportPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {reportPending && reportKind === "제안서" ? "작성 중…" : "제안서"}
                </button>
                <button
                  onClick={makeDeck}
                  disabled={pptBusy}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {pptBusy ? "생성 중…" : "PPT 다운로드"}
                </button>
                {report && (
                  <button
                    onClick={downloadReport}
                    className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/60 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                  >
                    .md 다운로드
                  </button>
                )}
              </div>
            </div>
            {report && (
              <pre className="mt-3 max-h-[480px] overflow-auto rounded-xl border border-line bg-surface/60 p-4 text-[11px] leading-relaxed text-ink whitespace-pre-wrap">
                {report}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}
