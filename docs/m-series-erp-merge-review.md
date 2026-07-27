# GEO Studio(M1~M5) → ERP 병합·업그레이드 검토

> 작성: 2026-07-17 · 대상 소스: 사장님 업로드 `M1~M5` (GEO Studio, Python 5개 패키지, ~4,600 LOC).
> 목적: "GEO SEO marketing analysis" 프로젝트의 M1~M5를 ERP(`erp-v1`)로 병합·업그레이드하기 위한 **사전 검토(설계 전)**. 구현은 별도 승인 후.
> ⚠️ 본 문서는 이전 오판(디렉터 저장소 GrowthOps를 M시리즈로 착각) 을 **정정한 정본**이다.

---

## 진행 현황 (2026-07-18 업데이트 — 이식 완료·5/5)

TS 이식 방법 확립(파이썬 목→골든 픽스처→TS→골든 테스트) 후 **5개 모듈 전부 이식·화면 배선 완료**. 전부 `erp-v1` 배포, `src/server/geo-studio/*`.

| 모듈 | 로직 이식(골든) | ERP 화면 | 라우트 · 사이드바 |
|---|---|---|---|
| **M1 스캐너** | ✅ 7건 | ✅ | `/geo-scan` · GEO 스캐너 |
| **M2 CEP 파인더** | ✅ 19건 | ✅ | `/geo-cep` · CEP 파인더 |
| **M3 콘텐츠 빌더** | ✅ 16건 | ✅ | `/geo-content` · GEO 콘텐츠 |
| **M4 Path Analyzer** | ✅ 14건 | ✅ | `/journeymap(구 geo-path)` · GEO 여정 |
| **M5 채널플래너** | ✅ 22건 | ✅ | `/geo-planner` · GEO 캠페인 |

- **골든 78건 통과**(파이썬 원본과 수치·문자열 완전 일치 — 정확 float·k-means·JSON-LD·TA·언급집계). `schema.prisma` 무변경 → 다른 ERP 업그레이드와 **충돌 0**.
- 공통 유틸: `geo-studio/py-compat.ts`(파이썬 round banker's·ISO date 호환).
- **현재 파이프라인은 목(mock) 기반**(결정적). 라이브 4-AI는 아래 P0에서 주입.
- **M1은 신규 화면으로 독립 이식**(geo-engine 무수정). 기존 `geo-engine`과의 dedup은 스키마·공용코드 접점이라 아래 P1로 남김.

### 남은 작업(성격이 다름 — 기존 코드/공용 레이어 접점 → 머지순서 조율 필요)
1. **M1 스캐너 ↔ `geo-engine` dedup**: ERP에 이미 4-AI 인용탐지 엔진 존재. 지금은 `/geo-scan`으로 **독립 이식**만 했고(무충돌), 향후 기존 엔진과 통합/정리는 기존 코드 수정이라 조율 필요.
2. **P0 라이브 LLM 레이어**: 이식 5모듈의 목→실제 4-AI 호출 전환(`integrations/llm` 단일화 + Gemini 이름 조율 §5). 공용 provider 코드 → 조율 필수.
3. (선택) **DB 영속화**: 현재 모든 화면 계산 전용(미저장). 스캔·캠페인·CEP·여정 저장이 필요하면 `schema.prisma` 신규 모델(§6) — 이것도 스키마 접점이라 조율.

> **권고**: 순수 신규 이식(충돌 0)은 5/5로 매듭. dedup/P0/DB는 스키마·공용코드를 건드리므로 **다른 ERP 업그레이드 머지 후** 조율해 진행.

---

## 0. TL;DR

- **진짜 M1~M5 = GEO Studio** (Generative Engine Optimization 스위트): `스캔→CEP발굴→콘텐츠생성→경로분석→채널/캠페인 실행` 파이프라인. **Python·async·dataclass**.
- **의존성이 사실상 없다.** 4,600 LOC 전체에서 서드파티 import는 표준 `unicodedata`뿐. k-means·임베딩유사도·여정트리·TA·ROI 전부 **순수 파이썬 + 결정적 목(mock) 폴백**. LLM SDK(openai/anthropic/httpx)는 live일 때만 **지연 임포트**. → **TypeScript 이식이 매우 유리**(numpy/sklearn 없음).
- **외부 의존은 4개 LLM 키뿐**: `OPENAI_API_KEY`(+임베딩 text-embedding-3-large)·`ANTHROPIC_API_KEY`·`GEMINI_API_KEY`·`PERPLEXITY_API_KEY`. **ERP `geo-engine/`이 이미 이 4개를 그대로 사용** → 토큰 중복 문제 거의 자동 해소(이름 1건만 조율).
- **ERP는 이미 GEO 엔진을 보유**(`src/server/geo-engine/`: 4-AI 어댑터·인용탐지·SoV·llms.txt·주간크론 + `GeoQuestion`/`GeoAnswerRecord`). → **M1·M4·M3일부는 재구축이 아니라 이 엔진 확장/dedup**. 순net-new는 M2(CEP)·M5(캠페인).
- **캠페인**은 M5(`geo_channel_planner/campaign.py`)의 기능: 목표→태스크→채널믹스→ROI. 별도 "캠페인 1~5" 축이 아니라 **M5의 실행 계획 로직**.

---

## 1. GEO Studio 파이프라인 (5개 모듈)

```
M1 스캐너 ─────► M2 CEP 파인더 ─────► M3 콘텐츠 빌더 ─────► M4 Path Analyzer ─────► M5 채널 플래너
(인용율 측정)     (진입계기 발굴·브리프)   (인용최적 콘텐츠)      (여정·TA·갭)          (캠페인·채널믹스·ROI)
   │                  │                    │                    │                    ▲
   └ citation_rate    └ cep_coverage/brief └ GEO점수 게이트      └ ta_score ──────────┘  (M1~M4 결과를 실행으로)
```

4대 AI = **ChatGPT·Gemini·Claude·Perplexity**를 병렬 인터로게이션하는 게 전 모듈 공통 기반.

---

## 2. 모듈별 소스 인벤토리

경로: 업로드 `M{n}/geo_*`. 각 모듈 `config.py`(설정)·`clients.py`(4-AI, live/mock)·`models.py`(DB대응 dataclass)·`__main__.py`(CLI)·오케스트레이터 공통 구조.

### M1 · GEO 스캐너 (`geo_scanner`, ~530 LOC)
- **목적**: 브랜드가 4대 AI 답변에 인용/언급되는지 측정(citation rate).
- **공개 API**: `scan(brand, keywords, competitors, platforms, variations)` → `ScanResult[]`; `detect(response_text, brand)` → `Detection{mentioned,count,contexts}`; `aggregate`/`mention_rate`; `build_queries`/`generate_variations`.
- **핵심**: 쿼리 변형 생성 → 4-AI 병렬 조회(async+세마포어) → 브랜드 정규식 탐지(±2문장 맥락) → 언급률 집계.
- **외부**: 4 LLM. **ERP `geo-engine/detect.ts`·`engines.ts`와 직접 중복.**

### M2 · CEP 파인더 (`cep_finder`, ~1,000 LOC) ⭐가장 net-new
- **목적**: Category Entry Points(소비자가 AI에 묻는 상황·맥락) 발굴 + 5차원 태깅 + 우선순위 + 경쟁사맵 + 콘텐츠 브리프.
- **공개 API**: `discover_ceps(brand, category, competitors)` → report; `build_probes/_multi`; `priority_score`; `share_of_ceps`/`whitespace_ceps`/`overlap_ceps`; `build_matrix`/`coverage_summary`; `build_brief(cep, type) → ContentBrief`(→M3 입력).
- **핵심**: 프로브30+ → 4-AI 인터로게이션 → 문장추출 → **임베딩(text-embedding-3-large) → 순수파이썬 코사인 k-means 클러스터링/중복제거** → 5차원 태깅(상황/감성/시간/장소/동반자) → Priority = 언급×기회×시장.
- **데이터모델**: `CEP`(5태그·priority_score·is_whitespace·ai_mention_count·…)·`CEPCandidate`·`CompetitorCEP`·`ContentBrief`. 기획안 스키마 `cep_projects/cep_entries/cep_competitor_map/cep_content_links`에 1:1(Supabase+pgvector 설계).
- **외부**: 4 LLM + **임베딩**. ERP에 대응물 **없음(신규)**.

### M3 · GEO 콘텐츠 빌더 (`geo_content_builder`, ~900 LOC)
- **목적**: AI 인용되는 콘텐츠로 재작성·구조화(BLUF·FAQ스키마·E-E-A-T·llms.txt).
- **공개 API**: `build_content(title, keyword, source_content, template_type, brand)` → `BuiltContent`; `analyze_geo`(GEO점수); `rewrite_bluf`/`bluf_score`; `generate_faq`/`build_json_ld`/`validate_json_ld`; `audit_eeat`; `crawl_and_generate`(llms.txt); `simulate_citation`(=M1 scan 계약); `render_template`(6종).
- **GEO 점수**: BLUF25·FAQ25·인용가능성30·E-E-A-T15·구조화5.
- **데이터모델**: `GeoScore·FAQSchema(json_ld)·EEATReport·LLMSTxt·CitationSimulation·BuiltContent`.
- **외부**: rewrite=GPT·faq=Claude·eeat=Gemini·simulate=Perplexity(전부 폴백). ERP 중복: **llms.txt는 `geo-engine/llms-txt.ts`에 이미 있음**; 콘텐츠 생성은 매거진/AiContent와 인접.

### M4 · GEO Path Analyzer (`geo_path_analyzer`, ~830 LOC)
- **목적**: AI 답변 속 질문 여정 트리·브랜드 미언급 갭경로·Topical Authority·인용 소스 역추적.
- **공개 API**: `analyze_journey`/`full_report`; `explore_journey`(재귀 여정트리); `analyze_gaps`/`top_paths`(Sankey); `compute_ta`(coverage40·quality35·trust25); `plan_clusters`/`missing_clusters`; `trace_sources`/`summarize_traces`.
- **데이터모델**: `JourneyNode/Tree·TopicalAuthority·ClusterPlan·SourceTrace`.
- **외부**: 4 LLM. ERP 중복: 인용 소스/경쟁 탐지는 `geo-engine/detect.ts`·`sov.ts`와 인접; 클러스터 플래너는 M2/콘텐츠기획과 연결.

### M5 · GEO 채널 플래너 (`geo_channel_planner`, ~750 LOC) ⭐net-new
- **목적**: M1~M4 결과 → 실행 캠페인(태스크·채널믹스·ROI·KPI·캘린더·리포트).
- **공개 API**: `build_campaign(name, goal, current, industry, team)`/`campaign_summary`; `decompose_goal`/`analyze_gap`(목표→태스크); `recommend_mix`(채널믹스); `calculate_roi`/`compare_scenarios`; `kpi_progress`/`make_snapshot`; `calendar_view`/`suggest_publish_timing`/`upcoming_deadlines`; `render_report`.
- **데이터모델**: `GEOGoal·CurrentState·ExecutionTask·ChannelAllocation·ChannelMix·ROIResult·KPISnapshot·Campaign`.
- **외부**: **AI 키 없이 완전 동작**(결정적 계획 로직). `CurrentState`는 M1(citation)·M2(coverage)·M4(ta)에서 채움. ERP 중복: 태스크=`WorkItem`, 캘린더=`CalendarEvent`, 리포트=`Report`, ROI/KPI는 신규.

---

## 3. 기술 특성 (병합 판단의 근거)

| 항목 | 사실 | 병합 함의 |
|---|---|---|
| 언어/구조 | Python, async, dataclass, 모듈당 clients/config/models/오케스트레이터 | 계약이 깔끔 → 이식 용이 |
| 서드파티 의존 | **사실상 0**(unicodedata만). k-means·임베딩유사도 자체구현 | numpy/sklearn 불필요 → **TS 포팅 현실적** |
| live/mock | 키 없으면 **결정적 목 폴백** 전 모듈 | 이식 시 **동일 목으로 골든테스트** 가능(회귀 안전) |
| 외부 API | 4 LLM + OpenAI 임베딩(M2) | ERP `geo-engine`이 이미 4-AI 사용 → **클라이언트 재사용** |
| 저장 설계 | Supabase Postgres + **pgvector**(M2 임베딩) | ERP=Neon Postgres. pgvector 확장 여부만 결정(또는 임베딩 미저장·온디맨드) |
| 비밀값 | `OPENAI/ANTHROPIC/GEMINI/PERPLEXITY_API_KEY` | 전부 정규명, ERP 기보유. **Gemini 이름 1건만 조율**(§5) |

---

## 4. ERP 현황 대비 — 무엇이 dedup, 무엇이 신규

**핵심 앵커: ERP `src/server/geo-engine/`** (engines.ts 4-AI 어댑터 · detect.ts 언급/인용/경쟁 탐지 · sov.ts SoV · runner.ts 주간크론 · answer-page.ts · llms-txt.ts) + `GeoQuestion`/`GeoAnswerRecord` + `geo/page.tsx` + `geo-weekly.ts`.

| M | ERP 상태 | dedup/재사용 | 신규 구축 |
|---|---|---|---|
| **M1 스캐너** | **대부분 있음** | geo-engine `engines/detect` = 4-AI 인용탐지 그대로 | 쿼리변형·집계 지표를 스캐너 계약으로 정리 |
| **M2 CEP** | **없음(신규)** ⭐ | 4-AI 클라이언트만 재사용 | 프로브·임베딩·클러스터·태깅·경쟁맵·브리프 + 신규 모델 |
| **M3 콘텐츠빌더** | **부분** | llms.txt(geo-engine)·매거진 발행·AiContent | BLUF/FAQ-JSONLD/E-E-A-T/GEO점수/시뮬 엔진 |
| **M4 Path** | **부분** | detect/sov(인용·경쟁)·기존 클러스터 논의 | 여정트리·갭경로·TA·소스역추적 + 신규 모델 |
| **M5 캠페인** | **부분** | WorkItem(태스크)·CalendarEvent·Report·Notification(마감알림) | 목표분해·채널믹스·ROI·KPI 엔진 + 신규 모델 |
| (진단엔진) | 있음 | SEO 엔진 벤더링 = 별개 유지 | — |

**ERP 재사용 인프라**: 단일 크론 디스패처(`/api/marketing/cron`, 멱등 시퀀스) · provider 계층(`ProviderResult`/`provOk`) · 암호화 크레덴셜 볼트(`crypto.ts`+`ClientAccount`) · `StatusBadge`/대시보드/차트.

---

## 5. 시크릿·API 토큰 중복방지 (실측 반영)

GEO Studio가 쓰는 비밀값은 **4개 LLM 키뿐**이고 전부 정규명이라, 중복 위험이 낮다. 나머지 config는 전부 **비-시크릿 튜닝값**(`CEP_N_CLUSTERS`, `CEP_DEDUP_THRESHOLD`, `GEO_PATH_MAX_DEPTH`, `GEO_ROI_CTR/CVR/AOV`, `GEO_SCORE_GATE` 등) → 코드 기본값/설정으로.

| 정규 키 | GEO Studio | ERP | 조치 |
|---|---|---|---|
| `OPENAI_API_KEY`(+임베딩) | ✅ | ✅(`geo-engine`,`ai/image`) | 공유 — 그대로 |
| `ANTHROPIC_API_KEY` | ✅ | ✅ | 공유 — 그대로 |
| `PERPLEXITY_API_KEY` | ✅ | ✅ | 공유 — 그대로 |
| Gemini 키 | `GEMINI_API_KEY` | `GOOGLE_AI_API_KEY` | **이름 1건 조율**(하나로 통일 또는 폴백) |

**설계**: §이전 파이프라인 그대로 — 병합 모듈은 ERP `integrations/llm` **단일 LLM 레이어**만 호출(provider별 키 1개, 모델ID=설정), 절대 `process.env`를 직접 읽지 않음. 공용키=env(Doppler 단일소스 권장), 거래처별=DB AES-256-GCM 볼트. **M2 임베딩**도 이 레이어에 `embed()` 추가.

---

## 6. 데이터모델 매핑 (dataclass → Prisma/Postgres)

ERP엔 KV/Redis 없음 → 전부 Postgres. 신규 모델은 ERP 관례(cuid·`orgId?`·`clientId?`·`createdAt/updatedAt`·문자열 status·`Json?`·`@@unique([scope,date])`).

| GEO Studio | 결정 | ERP 대상(제안) |
|---|---|---|
| M1 `ScanResult`/`Detection` | **REUSE** | `GeoAnswerRecord`/`GeoQuestion` 확장(citation·contexts) |
| M2 `CEP`/`CEPCandidate`/`CompetitorCEP`/`ContentBrief` | **ADD** | `CepProject`·`CepEntry`(5태그·priorityScore·isWhitespace·embedding `Json`/pgvector?)·`CepCompetitor`·`CepBrief` |
| M3 `BuiltContent`/`GeoScore`/`FAQSchema`/`EEATReport` | **EXTEND+ADD** | 결과는 `MagazinePost`/`AiContent`에 GEO점수·faqJsonLd·eeat 필드 추가; `LLMSTxt`는 geo-engine 재사용 |
| M4 `JourneyTree`/`TopicalAuthority`/`ClusterPlan`/`SourceTrace` | **ADD** | `GeoJourney`(root `Json` 트리)·`TopicalAuthority`(coverage/quality/trust)·`GeoClusterPlan`·`GeoSourceTrace` |
| M5 `Campaign`/`ExecutionTask`/`ChannelMix`/`ROIResult`/`KPISnapshot` | **REUSE+ADD** | `ExecutionTask`→`WorkItem` 매핑; `GeoCampaign`·`ChannelMix`·`RoiScenario`·`GeoKpiSnapshot`(시계열 `@@unique([campaignId,snapshotDate])`) |

임베딩(M2)만 결정 필요: **(a)** Neon에 `pgvector` 확장 활성 → 벡터컬럼, **(b)** 임베딩 미저장·클러스터링만 온디맨드(순수파이썬 로직 이식이라 가능), **(c)** `Json` 배열 저장. → 권장 **(b)**(가장 가벼움, 재클러스터 필요 시 재계산).

---

## 7. 통합 방향 — 포팅 vs 파이썬 서비스

| 안 | 장점 | 단점 | 판정 |
|---|---|---|---|
| **A. TS 이식(권장)** | ERP 단일 스택·단일 배포, geo-engine 클라이언트 재사용, 목 골든테스트로 안전 이식, Vercel 서버리스 그대로 | 4,600 LOC 재작성(단, 순수로직이라 기계적) | ⭐ **권장** — 의존성 0라서 가장 현실적 |
| B. 파이썬 별도 서비스 | 재작성 최소 | 인프라 1개 추가(배포·인증·CORS·비용), LLM키·크레덴셜 2중관리, ERP와 데이터 왕복 | 비권장(중복 유발) |
| C. 하이브리드 | M2 임베딩·클러스터만 파이썬 | 부분 인프라 | 임베딩을 OpenAI로만 하면 불필요 |

→ **A(이식)**: 순수 로직 + 결정적 목이라 **모듈별로 "같은 입력→같은 출력" 골든테스트**를 걸고 안전하게 옮길 수 있음. Python은 참조 스펙으로 보존.

---

## 8. 단계별 로드맵 (구현은 승인 후)

- **P0 · 기반**: LLM 레이어 단일화 + Gemini 이름 조율 + geo-engine 클라이언트를 `integrations/llm`으로 정리(이식 모듈 공통 토대).
- **P1 · M1 dedup**: 스캐너를 기존 geo-engine 위 계약으로 통합(쿼리변형·집계). 최소 신규.
- **P2 · M2 CEP** ⭐: 최대 net-new. 프로브→인터로게이션→임베딩→클러스터→태깅→브리프 + `Cep*` 모델. 브리프가 M3 입력.
- **P3 · M3 콘텐츠빌더**: BLUF/FAQ-JSONLD/E-E-A-T/GEO점수/시뮬 → 매거진·발행 파이프라인에 결합.
- **P4 · M4 Path**: 여정트리·갭·TA·소스추적 + 모델. 대시보드(Sankey/트리) UI.
- **P5 · M5 캠페인** ⭐: 목표분해→WorkItem·채널믹스·ROI·KPI·캘린더·리포트. M1~M4 지표를 `CurrentState`로 수급.
- 각 단계 독립 배포. **다른 ERP 업그레이드 프로젝트와 P0(공통 provider/시크릿)만 머지순서 조율** 필요(P1~P5는 신규파일 위주 저충돌).

---

## 9. 사장님 결정 필요

1. **통합 방향** — TS 이식(권장) vs 파이썬 서비스? (§7)
2. **임베딩 저장** — pgvector 활성 vs 온디맨드 재계산(권장) vs Json? (§6)
3. **Gemini 키 이름** — `GOOGLE_AI_API_KEY`로 통일 vs 폴백 추가? (§5)
4. **범위·우선순위** — 5개 전체 순서 P1~P5 확정? M2(CEP)·M5(캠페인) 우선?
5. **착수 시점** — 다른 ERP 업그레이드와 P0 머지순서 조율.

---

## 부록. 근거 포인터
- GEO Studio: 업로드 `M1~M5` — 각 `geo_*/{config,clients,models,__main__}.py` + 오케스트레이터(`scanner/finder/builder/analyzer/campaign`.py), `M2~M5/README.md`.
- ERP: `src/server/geo-engine/*`(핵심 dedup), `seo-engine/*`, `marketing/*`, `jobs/*`, `integrations/*`, `crypto.ts`, `prisma/schema.prisma`, `app/api/marketing/cron/route.ts`.
- (참고·별개) 디렉터 저장소 GrowthOps M1~M4: GEO Studio와 무관. `desktop-tutorial/docs/API-KEYS-REGISTRY.md`는 생태계 시크릿 전략 참고용으로 유효.
