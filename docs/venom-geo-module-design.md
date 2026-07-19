# VENOM GEO 모듈 설계 — SEO/GEO 분리·연결 · 일별 누적 그래프 · 시각화 카탈로그
> 목적: "현실적·실행 가능한 VENOM만의 작동하는 GEO 워크트리 실체"
> 근거: VENOM GEO 문서세트(PDF) + GPTO 대시보드 레퍼런스(유튜브 캡처 13장) + ERP 실제 스키마
> 작성 2026-07-19 · 브랜치 erp-v1 · 짝문서: `venom-erp-workflow-design.md`

이 문서는 GEO 파트를 **당장 구현 가능한 형태**로 정의한다. 핵심 3요구:
1. **SEO와 GEO를 연결 선상에 두되, 분리 진행** (토대 vs 성과)
2. **특정 측정값을 일별 누적 → 가시성 좋은 그래프**
3. **GEO 모듈의 이미지화(시각화) 대상을 전부 정의**

> ⭐ 핵심 발견: ERP 스키마가 이미 일별 누적을 지원한다.
> - `GeoAnswerRecord(questionId, engine, checkedOn @db.Date, appeared, cited, competitorsMentioned)` — 질문×엔진×**일자** 관측 → 일별 GEO 언급률의 원천.
> - `ExposureSnapshot(keywordId, channel, rank, checkedOn @db.Date)` — 키워드×채널×**일자** 순위 → 일별 SEO 순위 누적.
> → "일별 그래프"는 **집계 + SVG 시각화**만 추가하면 된다(원천 데이터 모델 신설 불필요).

---

## 1. SEO ↔ GEO — 연결 선상, 분리 진행

두 트랙은 **같은 병원 SoT·같은 콘텐츠**를 공유하지만, **측정 소스·주기·비용·KPI·담당이 달라** 별도 트랙으로 운영한다.

| 축 | **SEO 트랙 (토대)** | **GEO 트랙 (성과)** |
|---|---|---|
| 질문 | "네이버·구글에서 우리가 노출/상위인가?" | "AI 답변이 우리 병원을 인용/언급하는가?" |
| 대표지표 | **월보장 순위 유지율** + 홈피 SEO 점수(0~100) | **AI 언급률 N/총** (+ 평균순위·모델수) |
| 원천(ERP) | `ExposureSnapshot`(일별 순위)·`PlaceRankRecord`·GSC/GA4·SEO엔진 | `GeoAnswerRecord`(질문×엔진×일별)·`GeoQuestion` |
| 측정 주기 | **매일**(guard-rank 크론) | **주 1회+수동**(AI 관측, 고비용·약관상 자동스크래핑 배제) |
| 계약 의미 | **계약상 약속**(순위 보장) | **전략 북극성**(장기 인용 우위) |

### 연결(continuum) — 왜 한 화면에 나란히
- **SEO 정비가 GEO 인용의 원천이다.** 테크니컬 GEO(JSON-LD·FAQPage·저자페이지)·구조화 콘텐츠가 곧 AI가 인용할 재료. → 상단에 **SEO Score / GEO Score를 나란히** 두고, 하나의 콘텐츠가 양쪽에 기여함을 시각적으로 연결.
- 단, **점수·대시보드·워크플로우·리포트 섹션은 분리**. 혼용 금지(정직성): 순위(절대·계약)와 인용(상대·전략)을 같은 그래프에 겹치지 않는다.

### 정직성 규칙(기존 원칙 계승)
- GEO 언급률은 **측정 시점 스냅샷**임을 항상 표기(“6/29 05:45 기준, 변동 가능”). LLM 답변은 실행마다 달라짐.
- 신뢰도 위해 **질문당 N회(기본 3) 반복 → 다수결**로 `appeared` 확정, 원시로그 보존. (§3 측정 규약)

---

## 2. 일별 누적 측정 → 시계열 (데이터·집계)

### 2.1 누적 대상 지표
**SEO 트랙(매일 자동):**
- 월보장 키워드 **순위**(채널별) — `ExposureSnapshot.rank` (이미 일별)
- GSC **노출·클릭**, GA4 **세션** — 일별(ChannelMetric)
- 홈피 **SEO 점수** — 정비 이벤트 시 스냅샷

**GEO 트랙(관측 실행 시점마다 = 일별 그래놀):**
- 질문별 **언급률**(mentionedModels/totalModels), **평균순위**, **모델수** — `GeoAnswerRecord` 집계
- 전체 **언급률**(전 질문 가중평균)
- **엔진별 언급률**(ChatGPT/Gemini/Claude/Perplexity/…)

### 2.2 신설 집계 모델 (additive, 비파괴)
원천은 그대로 두고 **집계 스냅샷**만 추가해 그래프·리포트를 빠르게 그린다.

```prisma
/// GEO 언급률 시계열 스냅샷 — 관측 실행(runAt)마다 질문/전체 단위로 집계 저장.
/// 원천은 GeoAnswerRecord. 이 표는 그래프·월간리포트·대시보드 조회 최적화용(캐시성).
model GeoCitationScore {
  id             String   @id @default(cuid())
  clientId       String
  questionId     String?  // null = 거래처 전체 집계
  runAt          DateTime // 관측 실행 시점(일별 그래놀)
  totalModels    Int      // 관측 대상 엔진 수
  mentionedModels Int     // 언급된 엔진 수
  mentionRate    Float    // mentioned/total (0~1)
  avgRank        Float?   // 언급 시 평균 등장 순위
  citedModels    Int      @default(0) // 공식 URL 인용 엔진 수
  byEngine       Json?    // {engine: {mentioned, rank}} 레이더·엔진표용
  competitors    Json?    // [{name, rate, models, avgRank}] 언급현황표용
  orgId          String?
  createdAt      DateTime @default(now())
  @@index([clientId, runAt])
  @@index([questionId, runAt])
}
```
> SEO 일별 순위는 `ExposureSnapshot`을 그대로 시계열로 읽으면 됨(신설 불필요).

### 2.3 집계 파이프라인
- **GEO**: 관측 실행(runGeoWatchNow / 수동기록) 종료 시 → 해당 runAt의 `GeoAnswerRecord`를 질문별·전체로 집계 → `GeoCitationScore` upsert. (엔진별·경쟁사별 분포는 `byEngine`/`competitors` Json에.)
- **SEO**: 기존 guard-rank 크론이 `ExposureSnapshot`을 매일 남김(그대로). 그래프는 `[keywordId, checkedOn]` 시계열 조회.

---

## 3. GEO 측정 규약 (현실성·비용)
- **엔진 셋(가변):** 키가 있는 엔진만 실행 — ChatGPT(+Web) · Gemini(+Web) · Claude(+Web) · Perplexity · (선택 Grok · Google AI Overview · Naver AI). `configuredEngines()` 기준. **없는 엔진은 분모에서 제외**(정직).
- **반복·다수결:** 질문당 기본 3회 → 과반 등장 시 `appeared=true`. 원시 3회 로그 보존. 변동성 완화.
- **매칭:** 병원명·별칭(자사 브랜드 + "다른 표기" 목록) 부분일치 → `appeared`. 공식 URL 포함 시 `cited`. (GPTO의 "자사 브랜드/제품 + 다른 표기" 개념 채택.)
- **경쟁사:** 답변 등장 브랜드 상위 N을 `competitorsMentioned`에 저장 → 언급현황표·경쟁맵.
- **비용 가드:** 12거래처 × 20질문 × N엔진 × 3회 = 상당량 → **주기(주1)·질문 우선순위(priority)·엔진 셋**으로 상한. 실행 전 예상 콜 수 표시.
- **약관:** 공식 API만. 자동 브라우저 스크래핑 배제(기존 원칙). 수동 관측은 캡처(evidenceUrl) 증빙.

---

## 4. GEO 시각화 카탈로그 (이미지화 대상 전수 정의)
GPTO 레퍼런스를 VENOM(오렌지 브랜드·병원 특화)로 재정의. 각 항목 = **이름 · 목적 · 차트형 · 데이터소스 · 배치**. 전부 **인라인 SVG**(코드베이스 방식, 외부 차트 라이브러리 미사용).

### A. 상단 요약 (SEO/GEO 연결 헤더)
| # | 시각물 | 형태 | 데이터 | 정직성 |
|---|---|---|---|---|
| A1 | **GEO Score / SEO Score 듀얼 게이지** | 반원 게이지 2개 나란히 + 연결선 | GeoCitationScore.mentionRate / SEO엔진점수·유지율 | 각 티어 배지 |
| A2 | **월별 최적화 발행 카운트** | 미니 막대(2~7월) | ContentPlan 발행수 | 실측 |
| A3 | **계약 요약 바** | 텍스트 스트립 | 질문수·월발행·기간·시작~종료 | — |

### B. GEO 트랙 시각물
| # | 시각물 | 형태 | 데이터 | 비고 |
|---|---|---|---|---|
| B1 | **전체 언급률 추이** ★북극성 | **일별 area 라인**(목표선·이동평균) | GeoCitationScore(전체) 시계열 | 상승 녹색/하락 회색, "0을 박제"한 기준선 마킹 |
| B2 | **AI 모델별 언급률 레이더** | 레이더(N축) 기존 vs 현재 오버레이 | byEngine(2 시점) | 우측 델타표(기존/현재/변화 ▲▼) |
| B3 | **질문별 모니터링 추이** | multi-line(우리=굵은선, 경쟁사=얇은선) | 질문 GeoCitationScore + competitors | 실행시점 X축 |
| B4 | **언급 현황 표** | 랭킹 테이블(브랜드·언급률·모델수·평균순위) | competitors Json | 우리 하이라이트, "N개 더보기" |
| B5 | **AI 모델별 응답 카드 그리드** | 카드 N개(모델명·언급률·언급여부✓·순위리스트·원문펼침) | GeoAnswerRecord(엔진별) | 언급=녹색테두리, 원문 evidenceUrl |
| B6 | **질문 언급률 델타 칩** | 인라인 칩(59%→92%, 7→12모델, 1.3위→1.1위) | 질문별 전/현 | 질문 목록 각 행 |
| B7 | **기회 점수 3카드** | 스탯 타일(브랜드 언급률·자사 언급 가능성·종합 기회점수 0~100) | 집계+AI 판정 | 전략 페이지 |
| B8 | **경쟁 브랜드 수 + 경쟁강도 배지** | 카운트+배지(경쟁 보통/심함) | competitors 수 | |
| B9 | **참조 출처** | 접이식 링크목록(N개 사이트) | 답변 출처 | |
| B10 | **최적화 전략 방향성** | 번호 리스트(5) | AI 도출 | "전략 재도출" |

### C. SEO 트랙 시각물 (분리 섹션)
| # | 시각물 | 형태 | 데이터 |
|---|---|---|---|
| C1 | **월보장 순위 일별 추이** | **일별 라인**(목표순위 점선·이탈 적색 마킹) | ExposureSnapshot(keyword·channel) 시계열 |
| C2 | **네이버 9영역 노출 매트릭스** | 히트맵(키워드×영역, 노출/미노출) | ExposureSnapshot/PlaceRankRecord |
| C3 | **홈피 SEO 점수 게이지** | 반원 게이지(0~100, 예 51→86) | SEO 엔진 진단 |
| C4 | **GSC 노출·클릭 / GA4 세션 일별** | 일별 라인/area | ChannelMetric |
| C5 | **월보장 유지율 도넛** | 도넛(유지/이탈) | 순위 vs targetRank |

### D. 운영·연결 시각물
| # | 시각물 | 형태 | 데이터 |
|---|---|---|---|
| D1 | **콘텐츠→SEO/GEO 기여 흐름** | 미니 sankey/화살표 | ContentPlan → 순위/인용 |
| D2 | **P0~P5 단계 진행바** | 스텝바(6단계) | Client.stage + GEO 체크리스트 |
| D3 | **월간 리포트 카드** | 요약(언급 0→N, 순위 유지율, 발행수) | 집계 종합 |

> 병원 특화 포인트: 측정질문은 **환자 자연어**("대구 수성구 도수치료 잘하는 정형외과?"), 인용 원천은 **FAQPage 스키마**. 리포트 대표 KPI는 **AI 언급률 N/총**(PDF의 N/80 규약과 정합).

---

## 5. 화면 구조 (거래처 GEO 워크스페이스)
GEO 7라우트를 **거래처 종속 단일 진입점**으로 통합(설계서 Q7 추천안):
```
거래처 상세 › GEO 탭
 ├ [연결 헤더] A1 듀얼게이지 · A2 발행카운트 · D2 P0~P5 진행
 ├ [GEO 성과]  B1 전체추이 · B2 레이더 · B7 기회점수  (탭: 개요)
 ├ [질문]      질문목록(B6칩) → 선택 › B3 추이 · B4 언급현황 · B5 응답카드 · B9 출처
 ├ [전략]      B10 방향성 · B8 경쟁  (전략 재도출)
 └ [SEO 트랙]  C1 순위추이 · C2 9영역 · C3 홈피점수 · C5 유지율  (분리 서브탭)
```
기존 `/geo-scan|cep|path|planner|content`는 이 워크스페이스의 도구 탭으로 링크(URL·골든테스트 보존).

---

## 6. 구현 로드맵 (현실적·단계)
- **G1 — 집계 백본:** `GeoCitationScore` 모델 + 집계 함수(GeoAnswerRecord→스냅샷) + 측정 반복/다수결·스냅샷 규약. *(데이터 원천 이미 존재 → 소규모)*
- **G2 — 북극성 그래프:** B1 전체 언급률 일별 area(목표·기준선) + C1 월보장 순위 일별 라인 = "일별 누적 그래프" 요구 직접 충족(인라인 SVG).
- **G3 — 시각화 세트:** B2 레이더 · B3 멀티라인 · B4 언급현황표 · B5 응답카드 · A1 듀얼게이지.
- **G4 — 워크스페이스 통합:** 거래처 GEO 탭으로 7라우트 진입점 통합 + D2 단계 진행 연결.
- **G5 — 전략·리포트:** B7 기회점수 · B10 방향성 · D3 월간리포트(언급률 대표지표).

**검증 한계:** 실제 4-AI 실측·일별 축적은 배포+키+크론 필요(샌드박스 불가). 샌드박스에선 집계함수·SVG차트·스키마를 유닛테스트·빌드로 검증하고, 실측 전환은 현장 키 투입 시 자동(“키 넣으면 켜짐”).

---

## 7. GPTO 레퍼런스 대비 VENOM 차별점(요약)
- GPTO=범용 브랜드 모니터링. **VENOM=병원 특화**(환자 자연어 질문·의료법 게이트·FAQPage 인용원천).
- GPTO는 주간/실행시점 추이. **VENOM은 SEO 순위를 매일 축적**해 GEO(주1)와 **연결·분리** 이중 트랙으로 제시.
- 정직성 레이어(측정시점·반복다수결·엔진셋 분모)로 **신뢰 가능한 리포트** — 고객문서에 그대로 사용 가능.
