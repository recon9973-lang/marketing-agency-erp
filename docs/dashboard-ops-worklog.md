# 대시보드·운영 자동화 작업 정리 (PR #36)

> 브랜치: `claude/erp-dashboard-top-layout-2i9pmz` · PR: [#36](https://github.com/recon9973-lang/marketing-agency-erp/pull/36)
> 범위: ERP 대시보드 상단 개편 → 역할 분리/권한 승격 → 플랫폼 공지 배너 → 순위 보장 히트맵 → 통합 알림 센터 → 월간 리포트 자동화
> 누적: 커밋 8개, 38개 파일, +2,327 / −353

이 문서는 **완료 작업 상세 + 데이터/크론/환경변수 + 미완성·대기 TODO**를 한곳에 정리한다.

---

## 1. 완료 작업 (6개 기능)

### ① 상단 히어로 → 역할별 Command Center
- **목적**: 인사말이 차지하던 최상단을 "지금 조치가 필요한 항목"의 액션 타일로 전환.
- **구현**: `src/components/dashboard/DashboardHome.tsx`
  - `commandsFor(role, …)` — 역할별 타일 세트, `cmdRank`로 위험(urgent·값>0) 항목을 좌상단 정렬.
  - 0건 항목은 muted 처리, 위험 항목엔 빨간 점. 인사 바는 한 줄로 축소.
- **동작**: 각 타일이 해당 화면(`/work`, `/approvals`, `/compliance`, `/finance` 등)으로 직결되는 클릭형 To-do.

### ② 역할별 대시보드 분리 + 관리자 최고관리자 승격(effective role)
- **목적**: 담당자·관리자·최고관리자의 화면·기능을 확실히 분리하고, 관리자를 승인으로 최고관리자와 동등하게.
- **화면 분리** (`DashboardHome.tsx`): 단일 컴포넌트를 역할별 3개 뷰로 조립.
  - 담당자(MARKETER): 본인 담당 거래처·업무 중심. 전사 위젯(영업/GEO/전사 모니터링) 없음.
  - 관리자(ADMIN): 배정 범위 운영 + 영업/GEO. 재무·전사 모니터링 제외.
  - 최고관리자(SUPER_ADMIN): 재무 포함 전체 경영판 + 전사 운영 모니터링.
  - 미사용·중복 `AdminDashboard`/`SuperAdminDashboard`/`MarketerDashboard` 3개 파일 삭제.
- **권한 승격** (effective role):
  - `prisma/schema.prisma`: `User.elevatedToSuperAdmin Boolean @default(false)` (additive → 자동 마이그레이션).
  - `src/server/session.ts`: `CurrentUser.role`을 **effective role**로 계산(승인된 ADMIN은 SUPER_ADMIN처럼 앱 전역 동작). 원래 역할은 `baseRole`로 보존.
  - `src/server/actions/employees.ts`: `setSuperAdminElevation` — **진짜 최고관리자(baseRole)만** 부여 가능(권한 상승 체인 차단), 대상은 ADMIN, 감사로그.
  - `src/components/settings/EmployeeSettings.tsx` + `settings/page.tsx`: "최고관리자 승격" 토글(진짜 최고관리자에게만 노출).

### ③ 구글·네이버 플랫폼 공지 배너 (자동 수집 + 수동 등록 + 실시간)
- **목적**: 검색 플랫폼 공지(네이버 블로그·플레이스·카페·알고리즘 / 구글 알고리즘·SEO·GEO)를 대시보드 상단 배너 한 개에 순환 노출, NEW 뱃지.
- **데이터**: 하이브리드
  - 자동 수집: `src/server/jobs/platform-updates.ts` — 등록 소스 RSS/Atom·JSON → `PlatformUpdate` upsert(`externalKey` 멱등 dedup).
  - 파서: `parse.ts`(RSS/Atom), `parse-json.ts`(스키마 비의존 JSON — 네이버 플레이스/카페 공지 페이지용).
  - 소스: `sources.ts` — 구글 Search Central(내장), 네이버 서치앤테크 블로그(내장), 네이버 스마트플레이스·카페 공지(내장, JSON), 그 외 `PLATFORM_UPDATE_FEEDS` 환경변수.
  - 수동 등록: `src/server/actions/platform-updates.ts` + `PlatformUpdatesManager.tsx`(설정 화면, 관리자+) — 등록·고정(pinned)·삭제·온디맨드 수집.
- **실시간**: 배너(`PlatformUpdateBanner.tsx`)가 60초 폴링 + 창 포커스 재조회로 새로고침 없이 노출. NEW = 게시 7일 이내 + localStorage 마지막 확인 시각 기준.
- **API**: `GET /api/platform-updates`(인앱, 세션 인증), `GET /api/platform-updates/cron`(CRON_SECRET, 3시간마다).

### ④ 순위 보장 현황 히트맵
- **목적**: 대행사 핵심 상품(월보장 순위)을 거래처×키워드 색상 그리드로 한눈에.
- **구현**: `src/server/repositories/rank-guarantee.ts` + `src/components/dashboard/GuaranteeHeatmap.tsx`
  - `guard-rank` 잡이 매일 적재하는 `ExposureSnapshot`의 **최신 순위만 소비**(추가 수집·비용 없음).
  - 상태: 유지(초록)/미달(주황)/이탈(빨강)/대기(회색) — `targetRank` 대비 최신 rank로 판정.
  - 이탈·미달 많은 거래처 상단 정렬, "조치 필요" 합계 뱃지.
  - 역할 스코프: 담당자는 본인 담당 거래처만, 관리자·최고관리자는 전체.
- **배치**: 세 역할 뷰 모두 Command Center 바로 아래.

### ⑤ 통합 알림 센터
- **목적**: 기존 헤더 벨(폴링·드롭다운·읽음)에 "통합" 레이어 — 종류별 구분·필터.
- **구현**: `src/domain/notifications.ts`(type→카테고리 분류, 순수) + `src/components/collab/NotificationBell.tsx`
  - 카테고리: 순위·성과 / 컨펌·승인 / 거래처 / 협업 / 근태 / 기타. 미매칭은 SYSTEM 강등.
  - 항목별 컬러 아이콘 + 카테고리 배지, 드롭다운에 카테고리 필터 탭(존재하는 종류·개수).
  - 데이터 변경 없음(`NotificationItem.type` 이미 존재).

### ⑥ 월간 성과 리포트 자동화
- **목적**: 수동(거래처별 클릭) 생성만 있던 월간 보고서를 월초에 전 거래처 초안 자동 생성.
- **구현**:
  - `src/server/marketing/monthly-report.ts`: `buildMonthlyReportDraft` 공유 빌더(집계+upsert). 수동 액션·자동 배치 단일 소스.
  - `src/server/actions/reports.ts`: 기존 `generateMonthlyReport`를 빌더에 위임하도록 리팩터(회귀 없음 — `report-assembly` 테스트 통과 확인).
  - `src/server/jobs/monthly-report.ts`: `runMonthlyReportDrafts` — 담당자 배정 거래처 대상, 담당 마케터를 작성자로, 멱등(기존 월 skip), 실패 격리, 상한 300.
  - **발행·전달은 사람 검토 후에만**(자동은 DRAFT까지 — 안전 원칙).
- **크론**: GET 월초(1일)에만 + POST `{"job":"monthly-reports"}`.

---

## 2. 데이터 모델 변경 (모두 additive)

| 모델 | 변경 | 용도 |
|---|---|---|
| `User` | `elevatedToSuperAdmin Boolean @default(false)` | 관리자→최고관리자 동등 권한 승인 |
| `PlatformUpdate` (신규) | platform/category/title/url/summary/source/externalKey(unique)/publishedAt/pinned/isManual/createdById/orgId | 플랫폼 공지 저장(자동+수동) |

> `prisma/sync-additive.mjs`가 `ADD COLUMN`/`CREATE TABLE`을 자동 적용 → 배포 시 별도 마이그레이션 불필요.

---

## 3. 크론/배치 정리

| 경로 | 스케줄 | 실행 잡 |
|---|---|---|
| `GET /api/marketing/cron` | 매일 00:00 UTC | 알림 스위프, 월보장 순위 감시, 채널 동기화, 매거진 초안, **플랫폼 공지(백업)**, GEO(월), **월간 리포트(1일)** |
| `GET /api/platform-updates/cron` | 3시간마다 | **플랫폼 공지 수집(주 경로)** |
| `POST /api/marketing/cron` | 외부 스케줄러 | `{"job": "platform-updates" \| "monthly-reports" \| …}` 개별 트리거 |

---

## 4. 운영 배포 체크리스트

- [ ] **`CRON_SECRET`** 설정 — Vercel Cron이 `Authorization: Bearer` 로 크론 호출(플랫폼 공지 3시간·월간 리포트 월초).
- [ ] **`PLATFORM_UPDATE_FEEDS`**(선택) — 신뢰하는 네이버 공식 블로그 RSS 추가. 예:
  `[{"sourceId":"naver-x","platform":"NAVER","url":"https://rss.blog.naver.com/<id>.xml","defaultCategory":"GENERAL"}]`
- [ ] 배포 후 설정 → "플랫폼 공지 배너 관리" → **"지금 자동 수집"** 으로 네이버 소스 실제 응답 확인.
- [ ] 순위 보장 히트맵은 보장 키워드(`Keyword.isGuaranteed`)가 있어야 노출 — 키워드 화면에서 지정.

---

## 5. 테스트 현황

- 신규 유닛 테스트: 플랫폼 공지 파서/분류(9), 순위 보장 판정(3), 알림 분류(5), 월간 리포트 배치(2), 세션 승격(1) 등.
- 전체 **182 passed**.
- **기존 실패 2건(이 작업과 무관, 환경 이슈)** — stash로 base에서도 동일 실패 확인:
  - `tests/server/session.test.ts > … by email` — `unstable_cache`가 Next 런타임 밖(vitest)에서 미동작.
  - `tests/domain/navigation.test.ts` — `next-auth`가 `next/server` 모듈 해석 실패(수집 단계).
- 참고: `tsconfig.json`의 `baseUrl` deprecation(TS5101)은 기존 경고로 빌드 무관.

---

## 6. 미완성 · 실행 대기 · 후속 TODO

### 🔴 미구현 (추천 후보 — 진행 대기)
- [ ] **의료법 게시 전 검수 게이트** — 발행 직전 자동 의료법 검수로 위험 콘텐츠 차단. (추천 #4, 미착수)
- [ ] **의료법 위험 알림 연결** — 현재 의료법 검수는 화면 조회 시 계산될 뿐, 검수 시점에 알림을 만드는 훅이 없음. 검수 저장 이벤트에 `notification.create`를 연결해야 통합 알림 센터의 "의료법" 카테고리가 실제로 채워짐. (도메인 분류·아이콘은 이미 준비됨)

### 🟡 배포 후 검증 필요 (실행 대기)
- [ ] **네이버 플레이스/카페 JSON 응답 실측** — `smartplace.naver.com/notices`, `notice.naver.com/notices/cafe?…`가 실제 JSON을 반환하는지 개발 환경 프록시 차단으로 미검증. HTML(SPA)이면 서버 수집이 비어 있을 수 있음 → 실제 API 주소로 교체 필요할 수 있음(실패는 소스별 격리, 무해).
- [ ] **네이버 서치앤테크 블로그 ID(`naver_search`) 실측** — RSS 표준 패턴은 맞으나 실제 응답 미확인. 비면 `PLATFORM_UPDATE_FEEDS`로 교체.

### 🟢 정책 결정 대기
- [ ] **승격된 관리자의 타인 승격 허용 여부** — 현재는 안전을 위해 "진짜 최고관리자만 승격 부여"로 제한(권한 상승 체인 차단). 승격 관리자에게도 부여권을 줄지 결정 필요.

### ⚪ 기술 부채 / 개선 여지
- [ ] 순위 보장 히트맵에 최근 N일 추세(스파크라인) 추가 여지 — 현재는 최신 스냅샷 단일 상태만.
- [ ] 플랫폼 공지 배너 항목을 통합 알림 센터에도 편입할지(현재는 배너 전용) — 조직 단위라 사용자별 알림화 시 스팸 우려.
- [ ] 기존 실패 테스트 2건의 vitest 환경 설정 보강(`next/cache`·`next-auth` 모킹) — 별도 인프라 작업.

---

## 7. 주요 파일 인벤토리

**신규**
- `src/domain/platform-updates.ts`, `src/domain/notifications.ts`
- `src/server/marketing/platform-updates/{parse,parse-json,sources}.ts`
- `src/server/marketing/monthly-report.ts`
- `src/server/jobs/{platform-updates,monthly-report}.ts`
- `src/server/repositories/{platform-updates,rank-guarantee}.ts`
- `src/server/actions/platform-updates.ts`
- `src/app/api/platform-updates/{route,cron/route}.ts`
- `src/components/dashboard/{PlatformUpdateBanner,GuaranteeHeatmap}.tsx`
- `src/components/settings/PlatformUpdatesManager.tsx`

**수정**
- `prisma/schema.prisma`, `vercel.json`
- `src/server/session.ts`, `src/server/actions/{employees,reports}.ts`, `src/server/repositories/settings.ts`
- `src/app/(erp)/{dashboard,settings}/page.tsx`, `src/app/api/marketing/cron/route.ts`
- `src/components/dashboard/DashboardHome.tsx`, `src/components/collab/NotificationBell.tsx`, `src/components/settings/EmployeeSettings.tsx`

**삭제**
- `src/components/dashboard/{AdminDashboard,SuperAdminDashboard,MarketerDashboard}.tsx` (미사용·대체됨)
