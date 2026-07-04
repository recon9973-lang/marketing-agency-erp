# VENOM Marketing Engine (VME) — 기획서

> 상태: **S0 기획 (초안 v0.1)** · 작성일 2026-07-04 · 브랜치 `claude/venom-marketing-program-rlkqbl`
> 대상 저장소: `marketing-agency-erp` 내부 모듈로 구현(기존 ERP와 동일 코드베이스·DB·권한 규약 재사용)

---

## 1. 배경 및 현황 분석

### 1.1 베놈(Venom)이란
**베놈애드(VenomAd)** — 도메인 `venomad.com`, 제품/플랫폼 브랜드 **Markepick**(`markepick.com`, 마케픽) — 를 운영하는 **한국 마케팅 대행사**.
병원·지역업종(로컬) 고객을 중심으로 브랜드블로그, 블로그 SEO/배포, 영수증 리뷰, 네이버 플레이스 순위, SNS 운영, 계정 관리,
월간 리포트, 실적 수집을 서비스한다.
(근거: ERP `WorkCategory` enum. 주의: ERP `.env`의 `no-reply@venom.co.kr`은 예시 placeholder이며 실제 도메인이 아니다.)

### 1.2 현재 구성 중인 프로그램 (연동 대상)

| 저장소 | 성격 | 스택 | 역할 | VME 연동점 |
|---|---|---|---|---|
| **marketing-agency-erp** | 운영 백본(ERP) | Next.js 15 · React 19 · Prisma · PostgreSQL · NextAuth(Kakao) · Tailwind | 거래처/업무/캘린더/정산/지출/리포트/권한 관리 | **VME의 호스트**. Client·WorkItem·Report·ClientAccount 모델과 권한·감사 규약 공유 |
| **seo-generator** | SEO 글 생성 웹앱 | Node · OpenAI Responses API · Vercel serverless | 키워드→제목5·메타·목차·본문·FAQ·해시태그 자동 생성 | 콘텐츠 파이프라인의 **초안 생성기**(HTTP/서버리스 재사용) |
| **seo-writing-skill** | Claude Skill | `SKILL.md`(워크플로) + references | 발행가능 SEO 글 워크플로 + **의료광고법 준수** + GEO/AEO 최적화 + JSON-LD | 파이프라인의 **집필·검수 규격**. `seo-generator`와 산출 규격 호환 확인됨 |
| **design-resources-repository** | 디자인 자산 | — | 브랜드 이미지/템플릿 소스 | 크리에이티브 스튜디오의 **브랜드 자산 소스** |
| **your-supplement** | 별도 제품(engine/server/apps) | — | 영양제 추천·구매채널 | 초기 범위 외(추후 자사 제품 마케팅 대상으로 편입 가능) |
| **desktop-tutorial** | 실습용 | — | — | 범위 외 |

### 1.3 핵심 갭 (왜 이 프로그램이 필요한가)
ERP는 **"무엇을 해야 하는가"(WorkItem)** 와 **"결과가 어땠는가"(Report.metrics)** 를 관리한다.
그러나 그 사이의 **"실제 마케팅 산출물을 생산·검수·발행하고 성과를 자동 수집"** 하는 중간 레이어가
전부 수기(手記)다. 이미 코드에 그 의도가 남아 있다:
- `src/server/jobs/keyword-rank.ts` — 네이버 키워드 순위를 `Report.metrics`에 자동 적재하는 **골격만** 존재(프록시 위임 TODO).
- `Report.metrics(Json)` — 성과 지표를 담는 자리는 있으나 채우는 자동화가 없음.
- `ClientAccount` — 채널 자격증명을 AES-256-GCM으로 저장(발행 자동화 대비)하나 실제 발행 파이프라인 없음.

**VME는 이 중간 레이어를 AI + 연결된 MCP/API로 자동화하여, 각 `WorkCategory`를 실행 가능한 파이프라인으로 바꾼다.**

---

## 2. 제품 정의 — VENOM Marketing Engine

> **한 줄 정의:** 베놈 ERP에 내장되어, 거래처의 마케팅 업무(WorkCategory)를 *리서치 → 생성 → 검수 → 발행 → 성과수집 → 리포트*의 AI 파이프라인으로 실행하는 통합 마케팅 실행 엔진.

### 2.1 WorkCategory → VME 파이프라인 매핑

| WorkCategory | VME 파이프라인 | 주요 API/MCP |
|---|---|---|
| `BRAND_BLOG`, `BLOG_SEO` | **SEO 콘텐츠 파이프라인**: 키워드 리서치 → 초안 → 의료광고법 검수 → 발행 | 네이버 DataLab/Search · seo-generator(OpenAI) · seo-writing-skill · Claude · WordPress |
| `BLOG_DISTRIBUTION` | **배포 파이프라인**: 다계정/다채널 예약 발행 | Make · WordPress · ClientAccount(crypto) |
| `PLACE_RANKING`, `PERFORMANCE_COLLECTION` | **순위·성과 수집**: 검색노출/플레이스 순위 수집 → `Report.metrics` | 네이버 search/local/datalab · `keyword-rank.ts` 확장 |
| `SNS_MANAGEMENT` | **크리에이티브 스튜디오**: 이미지/숏폼/카드뉴스 + 바이럴 예측 | Higgsfield(image/video/shorts/virality) · Canva |
| `RECEIPT_REVIEW` | **리뷰 콘텐츠 보조**: 리뷰 초안/가이드 생성 | Claude · seo-writing-skill |
| `MONTHLY_REPORT` | **리포트 자동 조립**: metrics → PDF | `report-pdf.ts` 확장 · 대시보드 |
| `ACCOUNT_MANAGEMENT` | 채널 계정 상태·자격증명 관리(기존 ERP) | ClientAccount · ChannelType |

### 2.2 이중 실행 모델 (설계 핵심)
동일한 도메인 로직을 두 경로에서 호출 가능하게 한다.
1. **에이전트 경로 (Claude 세션/MCP)** — 담당자가 스튜디오 UI에서 "이 거래처 이번 달 브랜드블로그 3편" 요청 시 Claude가 MCP 도구(네이버/Higgsfield/Canva/WordPress)를 오케스트레이션.
2. **서버·크론 경로 (직접 API)** — 순위/성과 수집처럼 정기 배치가 필요한 작업은 서버가 provider 어댑터로 직접 호출(예: `runMonthlyKeywordCollection`).

→ 그래서 **provider 어댑터 계층**을 두어 "MCP 호출"과 "직접 API 호출"을 같은 인터페이스 뒤로 숨긴다. 테스트·교체·중복제거 가능.

---

## 3. 아키텍처 및 연동 설계

### 3.1 배치 결정: ERP 내부 모듈
VME는 `marketing-agency-erp` 코드베이스 안에 모듈로 구현한다. 이유:
- Client/WorkItem/Report/ClientAccount와 **같은 DB·트랜잭션**을 써야 성과가 업무·거래처에 자연스럽게 연결됨.
- 기존 **권한 scope·감사 로그·`ActionResult` 규약·`crypto.ts`(자격증명)** 를 그대로 재사용 → 보안·일관성 확보.
- 이미 존재하는 `studio` 관련 브랜치들(`erp-v2-studio-settings`, `studio-ui-visibility`, `add-manuscript-studio`)과 결이 맞음.

### 3.2 디렉토리 구조 (신규)
```
src/
  server/
    marketing/
      providers/            # 외부 연동 어댑터 (인터페이스 + 구현)
        types.ts            #   공통 Provider 인터페이스/결과 타입
        naver.ts            #   DataLab·검색·플레이스 (PlayMCP/직접 API)
        seo-content.ts      #   seo-generator 호출 + seo-writing 규격
        higgsfield.ts       #   이미지/숏폼/virality
        canva.ts            #   카드뉴스/브랜드 템플릿/export
        wordpress.ts        #   발행
        make.ts             #   시나리오 오케스트레이션
        llm.ts              #   Claude/OpenAI 검수·리라이트
      research.ts           # 키워드/트렌드/경쟁 리서치 서비스
      content-pipeline.ts   # 초안→검수 게이트→WorkItem 연결
      creative.ts           # 크리에이티브 자산 생성
      publish.ts            # 발행/배포 잡
      compliance.ts         # 의료광고법 검수 규칙(seo-writing 참조 이식)
    jobs/
      keyword-rank.ts       # (기존) provider로 리팩터
      collect-performance.ts# (신규) 성과 배치
  app/
    (erp)/studio/           # 스튜디오 UI (리서치/콘텐츠/크리에이티브/발행/성과 탭)
    api/marketing/
      webhooks/route.ts     # Make/발행 상태 콜백
      cron/route.ts         # 스케줄 트리거(보호된 시크릿)
  domain/
    marketing/              # zod 스키마·상태머신·순수 도메인 규칙
```

### 3.3 재사용하는 기존 규약 (신규 발명 금지)
- `src/server/action-result.ts`의 `ActionResult<T>` / `ok` / `fail` — 모든 스튜디오 액션 응답.
- `requireCurrentUser()`, `requireRole`, `requireClientAccess` — 권한 게이트.
- `writeAuditLog(...)` — 콘텐츠 발행·자격증명 사용 등 민감 작업 기록.
- `src/server/crypto.ts` (AES-256-GCM) — 채널 자격증명 복호화는 발행 시점에만, 서버에서만.
- `Report.metrics(Json)` — 성과 수집 적재 위치(수기 지표 보존 병합).
- `report-pdf.ts` — 리포트 렌더 확장.

---

## 4. 데이터 모델 확장 (Prisma 초안)

기존 모델과 FK로 연결. 신규 모델/enum 전문은 [`docs/venom-marketing-engine-schema.prisma`](./venom-marketing-engine-schema.prisma) 참조.
(원격 환경에서 `prisma migrate` 실행 불가 → 라이브 `schema.prisma`를 바로 건드리지 않고 fragment로 분리, 로컬 마이그레이션 가능 시점에 병합)

- `KeywordResearch` — 키워드/트렌드 리서치 스냅샷(거래처·월 단위)
- `ContentAsset` — 콘텐츠 자산 + 파이프라인 상태(`PipelineStage`, `ComplianceVerdict`)
- `CreativeAsset` — 생성 크리에이티브(이미지/숏폼/카드뉴스)
- `PublishJob` — 발행/배포 잡(예약·상태추적)
- `Client`/`WorkItem`/`User`/`ClientAccount`에는 역참조 relation만 추가(비파괴적, 컬럼 추가 없음).

---

## 5. API / MCP 매핑 (필요 API 총동원)

| 목적 | 1순위 도구 | 세부 |
|---|---|---|
| 키워드 수요·계절성·연관어 | **네이버 DataLab**(PlayMCP) | `datalab_search`, `datalab_shopping_*`, `find_category` |
| 경쟁강도·플레이스·리뷰·노출순위 | **네이버 검색**(PlayMCP) | `search_blog`, `search_shop`, `search_local`, `search_webkr`, `search_news` |
| 블로그 본문 초안 | **seo-generator**(OpenAI) + **seo-writing-skill** | 제목5·메타·목차·본문·FAQ·해시태그·JSON-LD |
| 문안 검수/리라이트/의료광고법 | **Claude API** + `compliance.ts` | seo-writing `references/medical-compliance.md` 규칙 이식 |
| SNS 이미지·숏폼·바이럴예측 | **Higgsfield** | `generate_image`, `generate_video`, `shorts_studio_*`, `virality_predictor`, `show_marketing_studio` |
| 카드뉴스·썸네일·브랜드일관성 | **Canva** | `search-brand-templates`, `generate-design`, `export-design` |
| 브랜드블로그 발행 | **WordPress.com** | `wpcom-mcp-content-authoring`, `wpcom-user-sites` |
| 다채널 예약·오케스트레이션 | **Make** | `scenarios_create/run`, `hooks_*` |
| 콘텐츠 캘린더/리서치 뷰(선택) | **Airtable** | `create_records_for_table` 등 |

**시크릿/키:** 신규 외부 키는 ERP `.env` 규약을 따른다(예: `NAVER_SEARCH_CLIENT_ID/SECRET`, `HIGGSFIELD_API_KEY`, `CANVA_*`, `WORDPRESS_*`, `MAKE_WEBHOOK_URL`, `OPENAI_API_KEY`). MCP 경로는 세션 인증을 사용하므로 서버 배치용으로만 직접 키가 필요.

---

## 6. 보안 · 컴플라이언스

1. **의료광고법 준수(최우선).** 베놈은 병원 고객 비중이 큼. 모든 `BLOG_POST`/`REVIEW_GUIDE`는
   발행 전 `COMPLIANCE_REVIEW` 게이트를 통과해야 함(`ComplianceVerdict`가 `BLOCK`이면 발행 차단).
   규칙은 `seo-writing-skill/references/medical-compliance.md`를 이식.
2. **자격증명 보호.** 채널 비밀번호는 기존 `ClientAccount.passwordEnc`(AES-256-GCM). 복호화는
   발행 실행 시점, 서버 메모리 내에서만. 로그·감사에 평문 절대 미기록.
3. **권한 scope.** 담당자는 본인 배정 거래처만; 관리자 scope 규칙 재사용. 발행·자격증명 사용은 audit.
4. **개인정보/저작권.** 생성 이미지·리뷰는 실인물/실후기 도용 금지 가드. 출처 없는 통계 단정 금지(seo-writing 원칙).

---

## 7. 개발 로드맵 (스프린트)

| 스프린트 | 산출물 | 완료 기준 |
|---|---|---|
| **S0 기획** ✅ | 본 문서 | 아키텍처·데이터모델·API매핑 합의 |
| **S1 스캐폴딩** 🔨 | Prisma 모델 + provider 인터페이스 + `ActionResult`/RBAC/audit 연동 + 스튜디오 설정(연결상태) | `pnpm test/build` 통과, 마이그레이션 무손상 |
| **S2 리서치·성과수집** | 네이버 어댑터, `keyword-rank.ts` provider 리팩터, 성과 배치 → `Report.metrics` | 키워드 리서치·순위수집 e2e, metrics 병합 테스트 |
| **S3 콘텐츠 파이프라인** | seo-generator/skill 통합, 의료광고법 검수 게이트, WorkItem 연결 | 키워드→검수완료 초안 흐름 테스트 |
| **S4 크리에이티브 스튜디오** | Higgsfield/Canva 어댑터, CreativeAsset | 이미지/숏폼 생성·바이럴점수 저장 |
| **S5 발행·배포** | WordPress/Make, PublishJob 예약발행 | 예약→발행→externalUrl 기록 |
| **S6 리포트 자동조립** | metrics→PDF, 대시보드 | 월간 리포트 자동 생성 |

각 스프린트 검증 게이트: `pnpm test && pnpm build && ALLOW_DEV_SESSION=true pnpm test:e2e`.

## 8. 리스크 · 미결정

- **네이버 공식 API 한도/약관**: 순위·플레이스는 공식 검색 API 범위와 크롤링 경계 확인 필요(`KW_PROXY_URL` 프록시 전략 유지).
- **MCP vs 직접키 경계**: 서버 크론은 세션 MCP를 못 쓰므로 provider 어댑터에 직접-API 폴백을 반드시 구현.
- **모듈 배치 확정**: 본 문서는 ERP 내부 모듈을 전제. 별도 마이크로서비스 선호 시 S1 착수 전 조정.
- **v2 브랜치 병합 상태**: 다수의 `erp-v2-*` 브랜치가 존재. S1은 default(`erp-v1`) 기준으로 시작하되, studio 관련 브랜치 병합 여부 확인 후 재베이스 가능.
