# GEO Studio Charter — 리스닝마인드형 인텐트 마케팅 모듈

> **이 문서의 지위**: GEO Studio 관련 **모든** 병합·개발의 단일 기준(Single Source of Truth).
> 새 작업은 반드시 이 틀 안에서 움직인다. 틀을 벗어나야 하면 먼저 이 문서를 고친다.
> 작성 2026-07-18 · 대상 브랜치 `erp-v1` · 참조: 리스닝마인드 패스파인더(Ascent Korea) 발표 25컷.

---

## 1. 목표 (What)

리스닝마인드 패스파인더의 **기능·출력물**을 ERP에 재현해 ERP를 업그레이드한다.
단, **자체 클릭스트림 DB가 없으므로**, 데이터는 아래 3.의 정책에 따라 **네이버 실측 API + 4-AI 하이브리드**로 조달한다.
"UI·분석 산출물은 리스닝마인드처럼, 데이터는 실현 가능한 실측+AI로."

---

## 2. 경계 (Boundaries) — 혼선 방지 규칙

여러 병합이 동시에 진행되므로, GEO Studio 작업은 **아래 네임스페이스 안에서만** 파일을 생성·수정한다.

| 계층 | 경로 | 규칙 |
|---|---|---|
| 로직(순수) | `src/server/geo-studio/**` | 자유 |
| **데이터 프로바이더** | `src/server/geo-studio/providers/**` | 신규 계층(4·5장) |
| 화면 | `src/app/(erp)/geo-*/**` | 라우트는 `/geo-*`만 |
| 컴포넌트/시각화 | `src/components/geo-*/**` | 자유 |
| 문서 | `docs/geo-*` | 자유 |

**조율 전까지 금지(동시 진행 ERP 업그레이드와 충돌 방지):**
- `prisma/schema.prisma` 수정 (DB 영속화가 필요하면 P3에서 별도 조율)
- `src/server/geo-engine/**` 수정 (기존 4-AI 엔진 — dedup은 나중 조율)
- `src/server/integrations/**`, `src/server/ai/**` 등 공용 레이어 수정
- 공용 컴포넌트 대규모 변경 (`AppShell` **nav 항목 추가만** 허용)

**허용:** `AppShell`에 `/geo-*` 네비 항목 추가, 신규 API 라우트 `src/app/api/geo/**`.

---

## 3. 데이터 소스 정책 (핵심)

모든 데이터는 아래 **티어**로 분류하고, **화면에 티어 배지(실측/AI/근사)를 항상 표기**한다(신뢰성 투명성).

| 데이터 | 소스 | 티어 |
|---|---|---|
| 검색량(연·월·일) | 네이버 데이터랩 `datalab_search` | 🟢 실측 |
| 연관 키워드 | 네이버 연관검색·자동완성 | 🟢 실측 |
| SERP 순위·URL·스니펫·관련질문 | 네이버 `search_blog/webkr/news/kin` | 🟢 실측 |
| 카테고리 | 네이버 `find_category` | 🟢 실측 |
| 검색자 성별·연령 | 데이터랩 `by_age/by_gender`(쇼핑 기준) | 🟡 부분실측 |
| CEP(진입점) 발굴·클러스터 태깅 | 4-AI + 임베딩 | 🔵 AI |
| 페르소나·질문리스트·GPT리뷰 | 4-AI | 🔵 AI |
| 콘텐츠 GEO 점수 | 규칙 엔진(M3) | 🔵 AI/규칙 |
| 생성엔진 인용률(M1) | 4-AI 실호출 | 🔵 AI |
| **분당 검색량·클릭스트림 전후전환** | (Ascent 독점 패널) | 🔴 미지원 → AI 시퀀스 **근사**, "근사" 라벨 필수 |

원칙: **실측 우선 → 없으면 AI → 그것도 없으면 근사(라벨)**. 어떤 화면도 목 데이터를 실측인 척 표기하지 않는다.

---

## 4. 파이프라인 아키텍처

```
[Providers]                      [Port]              [로직 M1~M5]      [오케스트레이터]   [화면]
NaverProvider  (🟢 실측)  ┐                                                              /geo-scan
AiProvider     (🔵 4-AI)  ├──→  SearchDataPort  ──→  scanner/cep/     ──→  runPipeline ──→ /geo-cep
MockProvider   (⚪ 목)    ┘      (단일 인터페이스)     content/path/                        /geo-path
                                                     campaign                              /geo-studio
```

**철칙: 로직(M1~M5)은 Port 인터페이스에만 의존한다.** 프로바이더를 갈아끼워도 로직 재작성 0.
- `providers/port.ts` — `SearchDataPort` 인터페이스(계약).
- `providers/mock.ts` — 현재 결정적 목(기존 `*/clients.ts` 래핑).
- `providers/naver.ts` — 네이버 MCP/API 어댑터(실측).
- `providers/ai.ts` — 4-AI 어댑터(CEP·페르소나·인용).
- `providers/resolver.ts` — `GEO_DATA_SOURCE=mock|naver|hybrid`(기본 `hybrid`)로 프로바이더 선택. 실측 실패 시 목 폴백.

**SearchDataPort 최소 계약(초안):**
```ts
interface SearchDataPort {
  searchVolume(keyword: string, period: "y"|"m"|"d"): Promise<VolumePoint[]>;   // 🟢
  relatedKeywords(seed: string): Promise<string[]>;                            // 🟢
  serpTop(keyword: string, limit?: number): Promise<SerpDoc[]>;                // 🟢
  demographics(keyword: string): Promise<Demographics | null>;                 // 🟡
  aiAnswers(prompt: string, platform: string): Promise<string>;               // 🔵
  meta: { tierOf(field: string): "measured"|"ai"|"approx" };
}
```

---

## 5. 리스닝마인드 기능 ↔ ERP 매핑

| 리스닝마인드 기능 | 우리 모듈/화면 | 데이터 티어 | 상태 |
|---|---|---|---|
| 인텐트 클러스터 버블맵 | M2 → `/geo-cep` (버블 SVG 신규) | 🔵+🟢 | 데이터✅/버블❌ |
| 클러스터 상세·검색량 | M2 + Naver 검색량 | 🟢 | 로직✅/실측❌ |
| GPT 리뷰(종합·페르소나·CEP) | M2+M3 → 탭 UI 신규 | 🔵 | 로직✅/탭UI❌ |
| 상위 URL 분석 | Naver `serpTop` → 표 신규 | 🟢 | ❌ |
| 검색 경로 그래프 | M4 → `/geo-path` | 🔵근사 | ✅ (2026-07-18) |
| 과거 비교·검색량 변동 | 시계열(P3, schema 필요) | 🟢 | ❌ |
| 유저 특성(성별·연령) | Naver `demographics` | 🟡 | ❌ |
| 브랜드검색지수 vs TV CM | 신규(P3) | 🟢 | ❌ |
| 통합 파이프라인·리포트 | `runPipeline` + `/geo-studio` | 혼합 | ✅ |

---

## 6. 로드맵 (단계 · 충돌여부)

| 단계 | 내용 | 충돌 | DoD |
|---|---|---|---|
| **P0** | 프로바이더 골격(`port`·`mock`·`resolver`) + 로직을 Port로 재배선 | 무충돌 | 기존 골든 87건 그대로 통과 |
| **P1** | UI 재현: 클러스터 버블맵 SVG · GPT리뷰 탭 · 페르소나 패널 · URL분석 표 | 무충돌 | 스크린샷 검증 |
| **P2** | `naver.ts` 실측 연동(검색량·연관어·SERP) + 티어 배지 | 무충돌 | 실측 응답 캐싱·폴백 확인 |
| **P3a** | 브랜드검색지수·시계열·과거비교 **라이브**(데이터랩 6개월, `buildBrandTrendIndex`) | 무스키마 ✅ | brand-index 6 tests·`/geo-cep` 패널 |
| **P3b** | 시계열 **스냅샷 저장**(장기추세·작년 동월비) | **schema 필요→조율** | 별도 승인 후 |

각 단계: 단위/골든 테스트 · `tsc` 0 · 스크린샷 · schema 무변경 확인 · 이 문서 갱신.

---

## 7. 명명·규약

- 라우트: `/geo-<기능>` (kebab). 예: `/geo-cep`, `/geo-scan`.
- 프로바이더: `providers/{port,mock,naver,ai,resolver}.ts`.
- 데이터 티어 배지: 공용 컴포넌트 `components/geo-common/TierBadge.tsx`(🟢실측/🔵AI/🔴근사).
- 환경변수: `GEO_DATA_SOURCE`(mock|naver|hybrid), 네이버 키는 `NAVER_*`(P2에서 정의).
- 커밋: `feat(geo-<모듈>): …`, 본문에 "schema 무변경" 명시.

---

## 8. 현재 자산 (2026-07-18 기준)

- 로직 이식: M1·M2·M4·M5 완전, M3 분석코어(생성계열 builder/templates/simulator/llms_txt 미이식·ERP 중복).
- 화면: `/geo-scan /geo-cep /geo-content /geo-path /geo-planner /geo-studio(+리포트)`.
- 시각화: 검색 경로 그래프 SVG(`/geo-path`).
- 테스트: 골든/배선 **87건** 통과. `schema.prisma` 무변경 유지 중.
- 전부 목(mock) 데이터 → P2에서 네이버 실측으로 교체 예정.
