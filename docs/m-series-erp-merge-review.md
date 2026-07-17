# VENOM GrowthOps(M1~M4) + 진단엔진 → ERP 병합·업그레이드 검토

> 작성: 2026-07-17 · 목적: `desktop-tutorial`(디렉터 정본)의 GEO/SEO 마케팅 프로그램을 ERP(`erp-v1`)로 병합·업그레이드하기 위한 **사전 검토(설계 전 단계)**.
> 원칙: 없는 건 추가, 부족한 건 채움. **API 토큰·내부구조 중복은 파이프라인으로 제거.** 구현은 별도 승인 후.

---

## 0. TL;DR

- **모듈 축은 M1~M4가 전부다.** "M5" 모듈은 **존재하지 않음**. 다섯 번째로 보이던 **SEO/GEO 진단 엔진은 M시리즈가 아니라 별도 제품이며, 이미 ERP에 벤더링·가동 중**(재구축 금지, dedupe만).
- **"캠페인 1~5"는 접근 가능한 두 저장소(desktop-tutorial·ERP) 어디에도 정의가 없음.** 강의 `Session1~5`(별개)만 존재 → **사장님 확인 필요**(§8).
- 포팅 난이도: **M1·M2·M4 = 순수 로직(거의 그대로 TS 이식)**, **M3 = 절반(파서는 순수, fetch·저장은 재작성)**, **진단엔진 = 순수(이미 보유)**.
- ERP는 이미 **단일 크론 디스패처 + 멱등 잡 + provider 계층 + 암호화 크레덴셜 볼트**를 갖춰, M모듈을 "얹기" 좋은 상태. 신규 서버리스 함수 한도(Vercel 12개) 제약은 Next.js route 구조에서 **소멸**.
- 최대 리스크는 코드가 아니라 **시크릿 이름 불일치**(네이버·Gemini)와 **LLM provider 이중구현**. → 파이프라인 §4에서 제거.

---

## 1. 용어 정리 (혼동 방지)

| 축 | 정체 | 개수 | 상태 |
|---|---|---|---|
| **모듈 M1~M4** | VENOM GrowthOps (검색 성장 자동화) | **4개** | desktop-tutorial `venom-wordpress/preview/`에서 확인 |
| **진단 엔진** | 룰기반 SEO/GEO 점수기(구 "M5" 오해) | 1개(별도 제품) | ERP에 이미 벤더링(SEO) + GEO 엔진 자체 보유 |
| **캠페인 1~5** | ❓ 정의 미발견 | ? | **사장님 확인 필요**(§8) |
| (참고) 강의 Session1~5 | 교육 자료(pptx) | 5개 | 캠페인 아님 |

---

## 2. 소스 인벤토리 — M1~M4 + 진단엔진

경로: `desktop-tutorial/venom-wordpress/preview/`. 저장은 전부 **GitHub JSON 파일**(`content/*.json`) + 일부 KV 언급이나 실제 코드는 JSON. API는 함수 한도 회피용으로 `api/growthops.js` 하나에 다중화.

| 모듈 | 파일 | LOC | 핵심 로직 | 외부 API | 포팅성 |
|---|---|---|---|---|---|
| **M1 토픽 클러스터** | `lib/topic-cluster.js` | 173 | 필러↔클러스터 설계, 글↔하위주제 매칭(코사인+동일 cat), 다음 빈칸 탐지 | 없음(키워드는 호출부가 주입) | **순수** → clusters.json만 Prisma로 |
| **M2 내부링크** | `lib/internal-linker.js` | 241 | 글간 관련도 점수, 고아글 탐지, 관련글 블록 idempotent 주입, 앵커 다양화 | 없음 | **순수** (그대로 이식) |
| **M3 SEO 모니터링** | `lib/psi.js`(+`search-console.js`, `growthops.js`) | 97(+GSC ~130) | PSI 파싱(CWV), GSC 순위(RS256 JWT 자체서명), 인덱싱추정, 일별 스냅샷 | Google PSI v5, GSC Search Analytics | **절반** — 파서 순수, fetch(`https`→`fetch`)·저장(JSON→Postgres) 재작성 |
| **M4 아웃리치 CRM** | `lib/outreach.js`(+`growthops.js` draft) | 143 | 매체/블로그 연락처, 리드→…→게재 파이프라인, 리마인더, 제안메일 초안 | (초안만) OpenAI | **순수** → outreach.json만 Prisma로 |
| **진단엔진(=구 "M5")** | `seo/seo-engine.js`(+`seo-rules.json`) | 700(+34룰) | URL→100점/5등급/카테고리별 점수, robots RFC9309 파서, 인포그래픽 | 없음(PSI는 호출부가 주입) | **순수**(가장 이식 쉬움) — 이미 ERP 벤더링 |

**통합 seam(M1/M2 ↔ 발행 파이프라인)**: `api/cron-daily-posts.js`의 cluster 모드(`TC.nextGap`→다음 슬롯 선정, `TC.fillSubtopic`→발행 후 채움), `linker.suggestLinks`+`injectRelatedBlock`(발행 직전 관련글 주입). 토글은 `posting-settings.js`(`mode`, `autoInternalLinks`, `clusterAutoExpand`).

---

## 3. ERP 현황 대비 갭 매트릭스

ERP 경로: `erp-v1`. 상태: HAS(구현됨) / PARTIAL(일부) / MISSING(없음).

| 모듈 | 상태 | ERP에 이미 있는 것(재사용) | 갭(추가할 것) |
|---|---|---|---|
| **M1 토픽 클러스터** | **PARTIAL** | 키워드 리서치(`marketing/research.ts`, 네이버 provider), `Keyword` 모델, 월별 `ContentPlan`(topic/angle/faq) | **필러↔클러스터 그래프 모델**, 커버리지/빈칸 스코어링, 키워드→클러스터 배정 |
| **M2 내부링크** | **MISSING** | (직접 없음) `render-plan.ts`(HTML 렌더), WordPress 발행 | **전부 신규**(순수 로직 이식) — `MagazinePost` 위에서 계산 |
| **M3 SEO 모니터링** | **PARTIAL(~70%)** | GSC/GA4 OAuth(`integrations/google.ts`)+일별 `channel-sync`, 순위 `keyword-rank`/`guard-rank`, `ExposureSnapshot`·`PlaceRankRecord`·`ChannelMetric` 시계열, `report-assembly` | **PSI(CWV) 미연동**(엔진은 mergePSI 지원하나 ERP가 PSI 호출 안 함), **링크헬스**, **인덱싱 API** |
| **M4 아웃리치 CRM** | **PARTIAL** | 영업 `Lead` 파이프라인+`nextActionAt` 리마인더(`daily-alerts`)+`Notification`+`Quote` | **매체/PR 연락처 도메인**(리드=병원영업과 다름), 아웃리치 상태전이, **제안메일 초안** |
| **진단엔진** | **HAS** | SEO 엔진 벤더링(`seo-engine/`)+`runSeoAudit`(리드 감사에 연결), **GEO 엔진 자체 보유**(`geo-engine/` ChatGPT·Perplexity·Gemini·Claude+SoV+주간크론) | **중복 제거만** + PSI 실연동(엔진 v1.8.0 동기화는 오더 #6) |

**ERP 크론 구조(핵심 재사용 자산)**: `vercel.json` 단일 크론 → `/api/marketing/cron`(GET=Vercel, `CRON_SECRET`; POST=외부/수동, `MARKETING_CRON_SECRET`). 순차 멱등 실행: `daily-alerts → guard-rank → channel-sync → magazine-autodraft → work-recur → (월)geo-watch`. **M3 스냅샷·M4 리마인더는 새 스케줄러 없이 여기 훅**.

---

## 4. 시크릿·API 토큰 중복방지 파이프라인 ★

> 원칙(레지스트리 `API-KEYS-REGISTRY.md`와 일치): **값은 시크릿 매니저 단일소스에만. git·DB·문서 금지. 코드는 정규 이름 하나만 읽는다.**

### 4.1 즉시 조치가 필요한 이름 불일치(값 넣어도 조용히 실패하는 함정)
| 정규 이름 | 문제 | 위치 | 조치 |
|---|---|---|---|
| `NAVER_CLIENT_ID/_SECRET` | ERP `providers/naver.ts`가 `NAVER_SEARCH_CLIENT_*`(폴백 없음) 사용 → 정규명으로 넣으면 **CONFIG_MISSING** | `marketing/providers/naver.ts` | 정규명으로 통일(또는 폴백 추가) |
| Gemini 키 | `GEMINI_API_KEY`(레지스트리)/`GOOGLE_AI_KEY`(M구)/`GOOGLE_AI_API_KEY`(ERP실제) **3종** | `geo-engine/engines.ts` | 하나로 확정(권장: `GOOGLE_AI_API_KEY` 또는 폴백) |
| `NAVER_AD_*` | M엔 구이름 폴백 있음, ERP엔 없음 | `integrations/naver-search.ts` | `NAVER_AD_*` 정규 채택(현재 일치) |

### 4.2 LLM provider 이중구현 제거
- **M = OpenAI 우선**(생성 전반), **ERP = Anthropic 우선**(`ai/claude.ts`, `claude-opus-4-8` 고정). OpenAI는 ERP에서 전사·이미지 등 비생성 용도.
- **양쪽 다 4엔진(OpenAI·Perplexity·Gemini·Claude) 노출매트릭스를 각자 중복 구현**(M `lib/ai-engines.js` ↔ ERP `geo-engine/engines.ts`).
- → **단일 `integrations/llm` 레이어**: `complete()/completeJson()/stream()` + provider enum, provider별 env 키 **하나씩**, 모델ID는 시크릿이 아니라 **설정값**. 병합된 M엔진·ERP 생성기 모두 이 레이어만 사용.

### 4.3 통합 provider 구조(서비스당 클라이언트 1 + env 이름 1)
ERP는 이미 `ProviderResult`/`provOk`/`provFail` + `PublishProvider`/`ResearchProvider` 규약 보유. 병합 대상을 이 구조로 수렴:
```
src/server/integrations/
  llm/            OPENAI_API_KEY · ANTHROPIC_API_KEY · PERPLEXITY_API_KEY · <Gemini 1개>
  naver/          NAVER_CLIENT_ID/_SECRET(검색+데이터랩) · NAVER_AD_*(키워드도구)  ← NAVER_SEARCH_CLIENT_* 제거
  google-search/  PSI_KEY · GSC_SERVICE_ACCOUNT_JSON|(_CLIENT_EMAIL+_PRIVATE_KEY) · GSC_SITE_URL   (ERP OAuth GOOGLE_CLIENT_*와 별개 유지)
  publish/        PublishProvider: wordpress(WORDPRESS_*) + github-store(GITHUB_*)  ← 형제 provider
  storage/        S3 sink(STUDIO_S3_*) 단일 이미지/에셋 싱크
  messaging/      KAKAO_ALIMTALK_* · payments/ TOSS_*
```
각 모듈 규칙: env를 **한 번, 한 이름으로** 읽고 `xConfigured()` 노출(우아한 degrade), **다른 모듈은 그 provider의 `process.env`를 직접 읽지 않음**(grep/lint 게이트로 재발 방지).

### 4.4 크레덴셜 2면 분리(이미 ERP에 구현됨 — 재사용)
- **공용 플랫폼 키 → env(Doppler 단일소스 권장)**: 대행사 자체 계정(OpenAI/Anthropic/Naver/PSI/GSC/S3…). §4.3 provider가 소비.
- **거래처별 시크릿 → DB AES-256-GCM**: `crypto.ts`(`encryptSecret`/`decryptSecret`, `v1:` 버전prefix, `CREDENTIAL_ENC_KEY`) + `ClientAccount.usernameEnc/passwordEnc`. 거래처 자체 WP·네이버플레이스 로그인 등.
- **규칙**: "모든 거래처에 하나면 충분?" → env. "특정 거래처 로그인?" → 볼트(복호화 JIT·UI 마스킹·`recordAudit`). provider는 **"거래처 계정 override, 없으면 공용 env"** 한 seam으로 발행 주체 전환.

---

## 5. 데이터모델 매핑 (JSON/KV → Prisma/Postgres)

> ERP엔 **KV/Redis 없음** → M3 시계열은 전부 Postgres. (M코드도 이미 KV 버리고 JSON 사용 중이라 자연 수렴.) 신규 모델은 ERP 관례: `cuid` id·`orgId?`·`createdAt/updatedAt`·문자열 status·`@@unique([scope,dateCol])` 멱등 upsert.

| M-소스 | 결정 | 대상 모델·필드 |
|---|---|---|
| **blog-posts.json**(자사 글) | **REUSE/EXTEND `MagazinePost`** | 같은 개념(자사 미디어·WP발행). 확장: `slug· seoTitle· metaDesc· keywords· region· catCode· bodyHtml· images(Json)· views· validation(Json)· tokenUsage(Json)· publishedAt`. **ContentPlan 아님**(그건 거래처·의료법 게이트). M1/M2는 MagazinePost 위에서 동작 |
| **M1 clusters.json** | **ADD `TopicCluster` + `ClusterSubtopic`** | `TopicCluster{ orgId?, pillar, category, region="", status="active" }` · `ClusterSubtopic{ clusterId FK, kw, magazinePostId FK?, status="open", sortOrder }`(슬롯=MagazinePost FK) |
| **M2 링크그래프/고아** | **REUSE(계산) — 영속 그래프 없음** | MagazinePost 위 온디맨드 계산, 관련글 블록은 `bodyHtml` 내부. 롤업(고아수/평균링크)은 M3 스냅샷 행에 합침. 필요시 `MagazinePost.orphan Boolean` 비정규화 |
| **M3 CWV+스냅샷** | **ADD `SeoSnapshot`(+선택 `CwvMeasurement`)** | `SeoSnapshot{ orgId?, snapshotDate @db.Date, posts, orphanCount, orphanRate, avgLinksPerPost, cwv Json?, @@unique([orgId,snapshotDate]) }`. 개별 URL 차트 필요시 `CwvMeasurement{ url, strategy, measuredOn, performance,seo,lcpMs,cls,… @@unique([url,strategy,measuredOn]) }` |
| **M4 outreach.json** | **ADD `OutreachContact`(Lead 재활용 금지)** | `OutreachContact{ orgId?, name, type="guestpost", status="lead", site?, owner?, email?, notes?, nextActionAt?, history Json?(또는 OutreachEvent 자식), assigneeId? }`. 리마인더=`daily-alerts`+`Notification` 재사용 |

---

## 6. 통합 아키텍처 결론

1. **저장**: 전부 Postgres/Prisma로 수렴(GitHub-JSON·KV 폐기). `github-store`는 발행 provider로만 잔존.
2. **API**: Vercel 12함수 한도 소멸 → `growthops.js` 다중화를 **Next.js route/서버액션으로 분해**(모듈별 깔끔히).
3. **크론**: 신규 스케줄러 금지. `runTopicClusterExpand`/`runSeoSnapshot`/`runOutreachReminders`를 `/api/marketing/cron` 시퀀스에 등록.
4. **LLM/외부연동**: §4.3 provider 계층으로 단일화 → 토큰·클라이언트 중복 제거.
5. **UI**: `growthops.html`(정적) → ERP `(erp)` 라우트 + 기존 대시보드/`StatusBadge`/차트 재사용.

---

## 7. 단계별 실행 로드맵(제안 — 구현은 승인 후)

각 단계 독립 배포 가능. 의존성·효과 순.

- **P0 · 파이프라인 기반(선행)**: 시크릿 이름 정규화(§4.1), `integrations/llm` 단일화(§4.2), provider 구조 정리(§4.3). *코드 소량, 리스크 최소, 이후 전부의 토대.*
- **P1 · M2 내부링크**: 순수 이식, MagazinePost만으로 즉효, M3 링크헬스의 입력. 외부의존 0.
- **P2 · M1 토픽 클러스터**: `TopicCluster/ClusterSubtopic` + 매거진 자동초안 크론에 cluster 모드.
- **P3 · M3 모니터링**: PSI provider 신설(CWV) + `SeoSnapshot` 크론 + 링크헬스/인덱싱. GSC는 기존 재사용.
- **P4 · M4 아웃리치 CRM**: `OutreachContact` + 파이프라인 UI + 제안메일 초안(LLM 레이어).
- **P5 · 진단엔진 dedupe**: 벤더 엔진 v1.8.0 동기화(오더 #6) + PSI 병합 실연동, 리드 감사와 통합.

> 다른 프로젝트의 ERP 업그레이드와 **충돌 방지**: P0는 provider/시크릿이라 그 작업과 겹칠 수 있음 → **머지 순서 조율 후 착수**. P1~P5는 신규 파일 위주라 충돌 적음.

---

## 8. 사장님 결정 필요 사항

1. **캠페인 1~5 정의** — 무엇을/어디에? (a)강의 Session을 캠페인으로 지칭 (b)다른 프로젝트(영양제·원장님앱 등) (c)미문서화 구상 (d)특정 파일 위치. → 이 축의 병합 범위 결정.
2. **시크릿 매니저** — Doppler(멀티프로젝트 권장) vs Vercel env 유지.
3. **Gemini/네이버 이름 정규화 방향** — 위 §4.1 권장안 승인 여부.
4. **착수 시점** — 다른 ERP 업그레이드 프로젝트와의 머지 순서(특히 P0 provider 계층).
5. **범위** — M1~M4 전체 + 진단엔진 dedupe로 확정? 우선순위 조정?

---

## 부록. 근거 파일 포인터
- M소스: `preview/lib/{topic-cluster,internal-linker,psi,outreach}.js`, `preview/api/growthops.js`, `preview/api/cron-daily-posts.js`, `preview/seo/seo-engine.js`
- 기획: `desktop-tutorial/docs/PLAN-growthops.md`, `growthops-README.md`, `API-KEYS-REGISTRY.md`
- ERP: `src/server/marketing/*`, `src/server/geo-engine/*`, `src/server/seo-engine/*`, `src/server/jobs/*`, `src/server/integrations/*`, `src/server/crypto.ts`, `prisma/schema.prisma`, `src/app/api/marketing/cron/route.ts`
