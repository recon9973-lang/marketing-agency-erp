# 2026-07-13 작업 문서 — SEO 진단 파이프라인 통일 · GEO 영역 · ERP 내부 검색

이 세션에서 추가된 두 시스템(**SEO 진단 단일 파이프라인**, **ERP 내부 통합 검색**)의 설계·파일·사용·확장 방법을 정리한다.

| 커밋 | 내용 |
|---|---|
| `fc9e43b` | ERP SEO 진단을 VENOM 엔진 단일 파이프라인으로 통일 |
| `bb29911` | ERP 내부 통합 검색 — 대시보드 검색창 |
| `a84d4fd` | 전역 커맨드 팔레트(⌘K) + 원고·회의록·매거진 검색 |
| (디렉터 저장소, 패치 대기) | VENOM 엔진 GEO 영역 v1.8.0 — `seo-geo-category.patch` |

---

## 1. SEO 진단 파이프라인 통일

### 1.1 배경 / 문제

통일 전, SEO/GEO "진단"이 서로 다른 4개 채점 체계로 흩어져 있었다.

| 위치 | 체계 | 문제 |
|---|---|---|
| 디렉터 `seo-engine.js` | 정적 크롤 SEO(콘텐츠42·기술42·검색16) | ERP가 안 씀 |
| 디렉터 `auto_diagnose.py`(medirank) | 네이버 플레이스/통합검색 | 별개 목적 |
| ERP `LeadAuditPanel` | **수동 8항목 체크리스트** /100 | 자체 채점, 정본과 무관 |
| ERP `geo-engine/` | AI 인용 관측(LLM 질의) | 페이지 점수 아님 |

→ **정본을 총괄 디렉터의 `VENOM SEO Engine`으로 정하고, ERP는 자체 채점을 버리고 이 엔진을 통해서만 진단**하도록 통일했다.

### 1.2 아키텍처 — 벤더 + 자동 싱크

```
[총괄 디렉터 저장소]  recon9973-lang/desktop-tutorial
  venom-wordpress/preview/seo/
    ├─ seo-engine.js   ← 정본 엔진(의존성 0 UMD)
    └─ seo-rules.json  ← 규칙 + Google 문서 근거
                │
                │  scripts/sync-seo-engine.mjs (build마다 raw로 내려받음)
                ▼
[ERP 저장소]  src/server/seo-engine/
    ├─ vendor/seo-engine.cjs      ← 벤더 사본(직접수정 금지)
    ├─ vendor/seo-rules.json      ← 벤더 사본
    ├─ vendor/*.d.ts              ← 타입 선언
    ├─ vendor/VENDORED.md         ← 출처·동기화 안내
    └─ index.ts                   ← 서버 러너(HTML/robots 수집 → linkedom → analyze)
```

**핵심 원칙**: ERP는 엔진을 **실행만** 한다. 로직/규칙은 **디렉터 저장소에서만** 고친다. 여기(벤더 폴더)서 고치면 다음 싱크에 덮어써진다.

### 1.3 파일 맵 (ERP)

| 파일 | 역할 |
|---|---|
| `src/server/seo-engine/index.ts` | `runSeoAudit(url, keyword?)` — 사이트 HTML/robots 수집(브라우저→Googlebot UA 폴백) → linkedom DOM → `SEOEngine.analyze` → 정규화 결과 |
| `src/server/seo-engine/vendor/` | 정본 엔진 벤더 사본 + 타입 |
| `scripts/sync-seo-engine.mjs` | 정본 저장소 raw에서 엔진/규칙 동기화(실패 시 사본 유지) |
| `src/server/actions/leads.ts` → `runLeadSeoAudit` | 리드 홈페이지를 엔진으로 진단하고 결과 저장 |
| `src/components/leads/LeadAuditPanel.tsx` | 엔진 자동진단(등급·6영역 점수바·개선항목) UI + 수동 체크리스트(보조) |
| `prisma` `Lead.auditResult/auditEngineVersion/auditRunAt` | 엔진 결과 저장 컬럼(additive 마이그레이션 `2026-07-13_lead_seo_audit.sql`) |

### 1.4 항상 최신화 (파이프라인)

`package.json`의 `build`가 `next build` 직전에 싱크를 실행한다 → **배포마다 디렉터 최신 엔진으로 자동 갱신**.

```jsonc
"build": "(node scripts/sync-seo-engine.mjs || echo '...') && prisma generate && ... && next build",
"seo:sync": "node scripts/sync-seo-engine.mjs"
```

환경변수(선택):

| 변수 | 기본값 | 용도 |
|---|---|---|
| `SEO_ENGINE_REPO` | `recon9973-lang/desktop-tutorial` | 정본 저장소 |
| `SEO_ENGINE_REF` | `main` | 브랜치/태그 |
| `SEO_ENGINE_SYNC_TOKEN` | (없음) | 정본이 비공개일 때 raw 인증 토큰 |

수동: `node scripts/sync-seo-engine.mjs` / `--check`(갱신 필요 여부만).

### 1.5 사용법

1. `/leads`에서 리드 상세로 진입(홈페이지 URL이 등록돼 있어야 함).
2. **"자동 진단 실행"** → 엔진이 사이트를 수집·채점 → 등급·6영역 점수바·개선항목(배점순) 표시.
3. 포커스 키워드(선택)를 넣으면 제목·본문 키워드 배치까지 평가.
4. 결과는 `Lead.auditResult`에 저장되어 재방문 시 그대로 열람.

> 로컬/샌드박스에서 실사이트 수집이 정책 차단될 수 있음. 실제 진단은 배포 환경(외부 접근 가능)에서 수행된다.

### 1.6 채점 영역 (엔진 v1.8.0 기준)

| 영역 | 배점 | 내용 |
|---|---|---|
| 콘텐츠 & 메타 | 42 | title·description·H1·ALT·링크텍스트·URL |
| 기술·크롤링 | 42 | HTTPS·robots·인덱싱·canonical·viewport·lang |
| 검색 노출 강화 | 16 | 구조화데이터·OG·sitemap·파비콘·robots.txt |
| 신뢰·전문성(E-E-A-T) | 16 | 저자·조직·최신성·연락처·엔티티(sameAs) |
| 콘텐츠 최적화 | 15 | 포커스 키워드 배치·소제목·가독성·스캔 |
| **GEO (AI 검색 최적화)** | **15** | **FAQ·Q&A·질문형 소제목·엔티티 그라운딩·도입부·최신성** (v1.8 신설) |
| 속도(CWV) | (별도) | PSI 실측 시 — 종합점수에서 분리 |

점수는 `total/max` 백분율로 정규화(속도 제외).

### 1.7 GEO 영역 (v1.8.0) — 디렉터 적용 대기

- **정본 엔진 변경**이라 디렉터 저장소에 적용해야 한다. 세션 권한상 ERP만 쓰기 가능해 **패치(`seo-geo-category.patch`)로 전달**됨.
- 적용: `cd desktop-tutorial && git checkout main && git am < seo-geo-category.patch && git push`
- 적용 후 **ERP는 코드 수정 없이** 다음 배포에서 GEO 영역이 자동 반영(러너는 `result.categories`를 그대로 렌더).
- 원칙: 폐기된 FAQ **리치결과**가 아니라 AI가 인용하는 **Q&A 콘텐츠**를 채점(정적 검출·환각 없음). 근거 [39][1][169][171][185][145].

---

## 2. ERP 내부 통합 검색

### 2.1 개요

대시보드 검색창 + 전역 ⌘K 커맨드 팔레트로 **ERP 안의 모든 것**을 검색한다: 페이지 이동·사용방법(즉시) + 데이터(서버).

### 2.2 아키텍처

```
[정적·즉시(클라이언트)]  domain/search/catalog.ts
   페이지 24 + 사용방법 15 — 역할 필터, 부분일치 스코어링

[데이터·서버]  server/actions/search.ts → server/repositories/search.ts
   거래처·업무·계약·보고서·원고·회의록·매거진·파일
   접근제어: clients.ts의 buildClientWhere를 관계 필터로 재사용

[UI 공용]  components/search/searchCore.tsx  (useErpSearch 훅 + SearchResultsList)
   ├─ ErpSearch.tsx       (대시보드 인라인)
   └─ CommandPalette.tsx  (전역 모달, ⌘K)
```

### 2.3 파일 맵

| 파일 | 역할 |
|---|---|
| `src/domain/search/catalog.ts` | 페이지·사용방법 정적 카탈로그 + `searchCatalog(query, role)`(순수) |
| `src/server/repositories/search.ts` | `searchErp(user, query)` — 역할 스코프 데이터 검색 |
| `src/server/actions/search.ts` | `erpSearchAction` — 로그인·스코프 검색 액션 |
| `src/components/search/searchCore.tsx` | 공용 훅 + 결과 리스트(그룹·키보드) |
| `src/components/search/ErpSearch.tsx` | 대시보드 인라인 검색창 |
| `src/components/search/CommandPalette.tsx` | 전역 ⌘K 팔레트 모달 |
| `src/components/erp/AppShell.tsx` | 헤더 검색버튼·모바일 아이콘·⌘K 리스너·팔레트 마운트 |
| `src/app/(erp)/dashboard/page.tsx` | 대시보드 상단에 `<ErpSearch/>` 배치 |

### 2.4 검색 대상 · 접근제어

| 대상 | 검색 필드 | 링크 | 스코프 |
|---|---|---|---|
| 바로가기(페이지) | 제목·키워드 | 각 페이지 | 역할 필터 |
| 사용방법 | 제목·키워드 | 관련 페이지 | 역할 필터 |
| 거래처 | 이름·코드·지역 | `/clients/[id]` | `buildClientWhere` |
| 업무 | 제목 | `/work` | 접근 가능 거래처 |
| 계약 | 제목 | `/contracts/[id]` | 접근 가능 거래처 |
| 보고서 | 제목 | `/reports` | 접근 가능 거래처 |
| 원고 | 주제 | `/manuscript` | 접근 가능 거래처 |
| 회의록 | 제목 | `/meetings/[id]` | 접근 거래처 + **사내회의는 관리자만** |
| 매거진 | 제목 | `/magazine` | 전 직원 |
| 파일 | 파일명 | `/vault` | 전 직원 |

- 즉시(카탈로그) + 서버(데이터, 200ms 디바운스, 최신 요청만 반영) 하이브리드.
- 타입별 조회 실패는 빈 배열로 흡수(검색이 통째로 죽지 않음).
- 키보드: `↑↓` 이동 · `Enter` 이동 · `Esc` 닫기 · `⌘K/Ctrl+K` 팔레트 토글.

### 2.5 확장법

- **검색 대상 추가**: `repositories/search.ts`의 `Promise.all`에 쿼리 + 매핑 추가, `SearchHitType`·`searchCore`의 `HIT_META`/`HIT_ORDER`에 타입 등록.
- **페이지·도움말 추가**: `domain/search/catalog.ts`의 `PAGES`/`HELP` 배열에 항목 추가(역할 지정).

---

## 3. 참고 산출물 (열람용 아티팩트)

- **SEO 실측 진단 리포터** — 구미 미소진치과(misojin.kr) 66/100 진단 뷰어.
- **ERP 상용화 결정 브리핑** — 도메인·호스팅·PWA·워드프레스·그라운드 서브도메인 판정 + 최소비용.

(아티팩트 URL은 세션 대화 참조. 저장소 외부 열람용.)

---

## 4. 후속 과제

- [ ] GEO 패치(`seo-geo-category.patch`)를 디렉터 저장소에 적용 → ERP 자동 반영 확인.
- [ ] 배포 환경에서 misojin.kr 실제 진단 → Google Doc 66/100과 대조(스키마 차이 포함).
- [ ] (선택) PWA 매니페스트 추가 — "앱처럼" 사용.
- [ ] (선택) 검색에 최근 방문·즐겨찾기 노출.
