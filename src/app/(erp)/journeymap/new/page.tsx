"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { expandSeeds } from "@/lib/journeymap/seeds";
import { uid, useProjectStore } from "@/lib/journeymap/store";
import { CollectOptions, HospitalProfile } from "@/lib/journeymap/types";

const DEPARTMENTS = ["치과", "피부과", "성형외과", "정형외과", "내과", "이비인후과", "안과", "한의원", "산부인과", "비뇨의학과"];

const EMPTY_PROFILE: HospitalProfile = {
  name: "",
  departments: [],
  regionSigungu: "",
  regionDong: "",
  mainTreatments: [],
  targetAge: "전체",
  targetGender: "전체",
  competitors: [],
};

function TagInput({
  tags,
  onChange,
  placeholder,
  max = 10,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
  placeholder: string;
  max?: number;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v) && tags.length < max) onChange([...tags, v]);
    setInput("");
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white px-3 py-2">
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-sm text-blue-700">
          {t}
          <button onClick={() => onChange(tags.filter((x) => x !== t))} className="text-blue-400 hover:text-blue-700">
            ×
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          // 한글 IME 조합 중 Enter는 무시 — 마지막 글자가 별도 태그로 추가되는 현상 방지
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={tags.length === 0 ? placeholder : "+추가"}
        className="min-w-24 flex-1 text-sm focus:outline-none"
      />
    </div>
  );
}

export default function NewJourneymap() {
  const router = useRouter();
  const { addProject, projects } = useProjectStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [profile, setProfile] = useState<HospitalProfile>(EMPTY_PROFILE);
  const [customDept, setCustomDept] = useState("");
  const [mainKeyword, setMainKeyword] = useState("");
  const [aiSeeds, setAiSeeds] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [checkedSeeds, setCheckedSeeds] = useState<Record<string, boolean>>({});
  const [options, setOptions] = useState<CollectOptions>({
    sources: ["naver", "google", "kin"],
    depth: 3,
    maxNodes: 200,
    useAi: true,
  });

  const existingProfiles = useMemo(() => {
    const seen = new Set<string>();
    return projects.map((p) => p.profile).filter((pr) => pr.name && !seen.has(pr.name) && seen.add(pr.name));
  }, [projects]);

  const ruleSeeds = useMemo(() => expandSeeds(mainKeyword, profile), [mainKeyword, profile]);
  const seeds = useMemo(() => {
    const all = [...ruleSeeds];
    for (const s of aiSeeds) {
      if (!all.some((o) => o.replace(/\s+/g, "") === s.replace(/\s+/g, ""))) all.push(s);
    }
    return all.slice(0, 20);
  }, [ruleSeeds, aiSeeds]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    seeds.forEach((s) => (next[s] = checkedSeeds[s] ?? true));
    setCheckedSeeds(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeds.join("|")]);

  const boostSeeds = async () => {
    if (!mainKeyword.trim() || aiLoading) return;
    setAiLoading(true);
    setAiNote("");
    try {
      const res = await fetch("/api/journeymap/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seeds", mainKeyword, profile, existingSeeds: seeds }),
      });
      const data = await res.json();
      if (data.unconfigured) setAiNote("OPENAI_API_KEY가 설정되지 않아 AI 보강을 쓸 수 없습니다.");
      else if (data.seeds?.length) {
        setAiSeeds((prev) => [...prev, ...data.seeds]);
        setAiNote(`AI가 시드 ${data.seeds.length}개를 추가했습니다.`);
      } else setAiNote("AI가 추가할 시드를 찾지 못했습니다.");
    } catch {
      setAiNote("AI 호출에 실패했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  const set = <K extends keyof HospitalProfile>(k: K, v: HospitalProfile[K]) => setProfile((p) => ({ ...p, [k]: v }));

  const step1Valid = profile.name.trim().length >= 2 && profile.departments.length > 0 && profile.regionSigungu.trim();
  const selectedSeeds = seeds.filter((s) => checkedSeeds[s]);
  const step2Valid = mainKeyword.trim().length >= 1 && selectedSeeds.length >= 2;

  const start = () => {
    const id = uid("p");
    addProject({
      id,
      mainKeyword: mainKeyword.trim(),
      profile,
      seeds: selectedSeeds,
      options,
      status: "collecting",
      nodes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    router.push(`/journeymap/map/${id}`);
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/journeymap" className="text-sm text-slate-500 hover:text-slate-900">
          ← 마인드맵 목록
        </Link>
        <h1 className="font-bold">새 마인드맵 만들기</h1>
        <div className="flex items-center gap-2 text-xs">
          <span className={step === 1 ? "font-bold text-blue-600" : "text-slate-400"}>● STEP1 병원</span>
          <span className="text-slate-300">─</span>
          <span className={step === 2 ? "font-bold text-blue-600" : "text-slate-400"}>● STEP2 키워드</span>
        </div>
      </div>

      {step === 1 ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-bold">STEP 1 — 병원 프로필</h2>
          <p className="mb-5 text-sm text-slate-500">&ldquo;병원 맞춤&rdquo; 마인드맵의 원천 데이터입니다.</p>

          {existingProfiles.length > 0 && (
            <div className="mb-5">
              <label className="mb-1 block text-sm font-semibold">기존 프로필 재사용</label>
              <select
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const found = existingProfiles.find((pr) => pr.name === e.target.value);
                  if (found) setProfile(found);
                }}
              >
                <option value="">— 신규 입력 —</option>
                {existingProfiles.map((pr) => (
                  <option key={pr.name} value={pr.name}>
                    {pr.name} ({pr.regionSigungu})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold">
                병원명 <span className="text-red-500">*</span>
              </label>
              <input
                value={profile.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="예) 밝은미소치과의원"
                maxLength={40}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">
                진료과 <span className="text-red-500">*</span> <span className="font-normal text-slate-400">(복수 선택)</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {DEPARTMENTS.map((d) => {
                  const on = profile.departments.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() =>
                        set("departments", on ? profile.departments.filter((x) => x !== d) : [...profile.departments, d])
                      }
                      className={`rounded-full border px-3 py-1 text-sm ${
                        on ? "border-blue-600 bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
                {/* 목록에 없는 진료과: 직접 추가한 항목은 선택된 칩으로 표시, ×로 제거 */}
                {profile.departments
                  .filter((d) => !DEPARTMENTS.includes(d))
                  .map((d) => (
                    <button
                      key={d}
                      onClick={() => set("departments", profile.departments.filter((x) => x !== d))}
                      className="rounded-full border border-blue-600 bg-blue-600 px-3 py-1 text-sm text-white"
                      title="클릭하면 제거"
                    >
                      {d} ×
                    </button>
                  ))}
                <input
                  value={customDept}
                  onChange={(e) => setCustomDept(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      const v = customDept.trim();
                      if (v && !profile.departments.includes(v)) set("departments", [...profile.departments, v]);
                      setCustomDept("");
                    }
                  }}
                  placeholder="+ 직접 입력 후 Enter (예: 재활의학과)"
                  className="min-w-56 rounded-full border px-3 py-1 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-semibold">
                  지역(시/군/구) <span className="text-red-500">*</span>
                </label>
                <input
                  value={profile.regionSigungu}
                  onChange={(e) => set("regionSigungu", e.target.value)}
                  placeholder="예) 강남"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">동/역세권 (선택)</label>
                <input
                  value={profile.regionDong}
                  onChange={(e) => set("regionDong", e.target.value)}
                  placeholder="예) 신사역"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">주력 시술/진료 (최대 10개)</label>
              <TagInput tags={profile.mainTreatments} onChange={(t) => set("mainTreatments", t)} placeholder="예) 임플란트 입력 후 Enter" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-semibold">타깃 연령 (선택)</label>
                <select
                  value={profile.targetAge}
                  onChange={(e) => set("targetAge", e.target.value)}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                >
                  {["전체", "20-30대", "30-40대", "40-60대", "60대 이상"].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">타깃 성별 (선택)</label>
                <select
                  value={profile.targetGender}
                  onChange={(e) => set("targetGender", e.target.value)}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                >
                  {["전체", "여성", "남성"].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold">경쟁 병원 (선택, 최대 5)</label>
              <TagInput tags={profile.competitors} onChange={(t) => set("competitors", t)} placeholder="예) △△치과 입력 후 Enter" max={5} />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Link href="/journeymap" className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              취소
            </Link>
            <button
              disabled={!step1Valid}
              onClick={() => setStep(2)}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              다음 →
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-bold">STEP 2 — 메인 키워드 & 수집 옵션</h2>
          <p className="mb-5 text-sm text-slate-500">
            {profile.name} ({profile.regionSigungu}) 프로필 기준으로 시드를 자동 확장합니다.
          </p>

          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-semibold">
                메인 키워드 <span className="text-red-500">*</span>
              </label>
              <input
                value={mainKeyword}
                onChange={(e) => setMainKeyword(e.target.value)}
                placeholder="예) 임플란트"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            {seeds.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-semibold">
                    추천 시드 미리보기 <span className="font-normal text-slate-400">(체크 해제 시 수집 제외)</span>
                  </label>
                  <button
                    onClick={boostSeeds}
                    disabled={aiLoading}
                    className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                  >
                    {aiLoading ? "AI 생성 중…" : "✨ AI 시드 보강"}
                  </button>
                </div>
                {aiNote && <p className="mb-2 text-xs text-violet-600">{aiNote}</p>}
                <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-50 p-3">
                  {seeds.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checkedSeeds[s] ?? true}
                        onChange={(e) => setCheckedSeeds((c) => ({ ...c, [s]: e.target.checked }))}
                      />
                      {s}
                      {aiSeeds.includes(s) && <span className="text-[10px] text-violet-500">AI</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold">데이터 소스</label>
              <div className="flex flex-wrap gap-4 text-sm">
                {(
                  [
                    ["naver", "네이버 자동완성"],
                    ["google", "구글 자동완성"],
                    ["kin", "네이버 지식iN 질문"],
                  ] as const
                ).map(([src, label]) => (
                  <label key={src} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.sources.includes(src)}
                      onChange={(e) =>
                        setOptions((o) => ({
                          ...o,
                          sources: e.target.checked ? [...o.sources, src] : o.sources.filter((x) => x !== src),
                        }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-semibold">수집 심도</label>
                <div className="flex gap-3 text-sm">
                  {([2, 3, 4] as const).map((d) => (
                    <label key={d} className="flex items-center gap-1.5">
                      <input type="radio" checked={options.depth === d} onChange={() => setOptions((o) => ({ ...o, depth: d }))} />
                      {d}단계{d === 2 ? " (빠름)" : d === 3 ? " (권장)" : ""}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold">최대 노드 수</label>
                <select
                  value={options.maxNodes}
                  onChange={(e) => setOptions((o) => ({ ...o, maxNodes: Number(e.target.value) as 100 | 200 | 400 }))}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                >
                  {[100, 200, 400].map((n) => (
                    <option key={n} value={n}>
                      {n}개
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={options.useAi} onChange={(e) => setOptions((o) => ({ ...o, useAi: e.target.checked }))} />
              🤖 AI 여정 분류 보정 사용 <span className="text-xs text-slate-400">(분류가 애매한 키워드만 AI가 재분류)</span>
            </label>

            <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
              ⏱️ 예상 소요: 약 1~3분 — 검색량·CPC 조회와 AI 보정이 켜져 있으면 조금 더 걸립니다.
            </p>
          </div>

          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep(1)} className="rounded-lg border px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              ← 이전
            </button>
            <button
              disabled={!step2Valid || options.sources.length === 0}
              onClick={start}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              수집 시작 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
