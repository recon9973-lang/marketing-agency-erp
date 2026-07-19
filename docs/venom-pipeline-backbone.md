# VENOM ERP 파이프라인 백본 — 완성 현황 (Phase 1~5)

> 목적: "껍데기만 있고 실제 쓰기 어렵던" ERP를, 8단계 업무 흐름을 **실제로 이어 주고
> 데이터가 다음 단계를 밀어 주는** 파이프라인으로 전환. 이 문서는 그 백본의 완성 현황과
> 코드 매핑, 그리고 남은 배포/운영 게이트를 정리한다.

작성 기준일: 2026-07-19 · 브랜치: `erp-v1`(원격 기본 브랜치)

---

## 1. 8단계 업무 흐름 ↔ 코드 백본 매핑

에이전시의 실제 업무는 8단계다. 리드(영업) 1~4단계와 거래처(운영) 5~8단계로 나뉘며,
각각 도메인 상태머신이 흐름을 강제한다.

| # | 업무 단계 | 상태 | 상태머신 |
|---|-----------|------|----------|
| 1 | 상담문의 | `Lead.status` NEW | `domain/sales/lead-stages.ts` |
| 2 | 자료수집·분석·컨설팅보고서 | CONSULTING | ↓ |
| 3 | 보고서 전달·미팅 | MEETING | ↓ |
| 4 | 계약 | WON → 거래처 전환 | ↓ |
| 5 | 담당자 배정·착수 | `Client.stage` ONBOARDING | `domain/sales/client-stages.ts` |
| 6 | 키워드 수집 | KEYWORD | ↓ |
| 7 | GEO 측정 | GEO | ↓ |
| 8 | 콘텐츠 제작·발행 | CONTENT → LIVE | ↓ |

> 설계 규약: `Lead.status`·`Client.stage`는 Prisma enum이 아니라 **String + 도메인 유니온**으로
> 관리한다(레거시 데이터 방어 + 마이그레이션 비용 0). 파싱은 항상 `toClientStage()`로 폴백.

---

## 2. Phase별 완성 내역

### Phase 1 — 단계 백본 (상태머신)
계약 이후 5~8단계를 `Client.stage`로 정의하고 전이 규칙을 코드로 강제.

- **전진**: 다음 단계로만 (ONBOARDING→KEYWORD→GEO→CONTENT→LIVE)
- **정정**: 오입력용 1단계 후진 허용, 2단계 점프 금지
- **예외**: 어느 활성 단계서든 일시중지·해지, 중지→복귀, 해지→재계약
- 전이는 **감사 로그**(`recordAudit`)에 before/after 기록, `stageUpdatedAt` 갱신
- UI: `ClientStageBar`(스테퍼 + 허용 전이 버튼만 노출)

### Phase 2 — 데이터 승계 (carry-forward)
"업체명·컨설팅 자료·계약서 정보를 다음 단계에서 재입력 없이 이어 쓴다"는 요구 구현.

- 리드 → 거래처 전환 시 컨설팅 보고서·견적 **재연결**(`leadId`→`clientId`)
- 컨설팅 보고서를 **계약 前에도** 생성 가능(`clientId` XOR `leadId`)
- 계약 생성 시 거래처 갑(甲) 정보 **역채움**(back-fill)
- 확정 키워드 → GEO 측정 질문으로 **인계**(키워드 기반 질의 자동 후보 생성)

### Phase 3 — 가시성 (여정 + 칸반)
"지금 어느 단계에 무엇이 있는지" 한눈에.

- `getClientJourney()`: 8단계 마일스톤을 시간순으로 집계(상담→컨설팅→미팅→계약→배정→키워드→GEO→콘텐츠)
- `ClientJourney`: 거래처 상세의 타임라인
- `ClientBoard`: 활성 5단계 칸반 보드(`/clients?view=board`)

### Phase 4 — 자동 전환 제안 (제안 + 사람 확인)
데이터 신호가 다음 단계 조건을 충족하면 전진을 **제안**(자동 이동 아님 — 사람 승인형).

```
suggestNextStage(stage, signals) → 다음 단계 | null
  ONBOARDING + 키워드 등록  → KEYWORD 제안
  KEYWORD    + GEO 관측     → GEO 제안
  GEO        + 콘텐츠 기획   → CONTENT 제안
  CONTENT    + 콘텐츠 발행   → LIVE 제안
```

- 각 제안은 상태머신상 **유효한 전진만**(`canTransitionClientStage` 보장)
- UI: `ClientStageBar`의 Sparkles 배너 + "{단계}로 이동" 확인 버튼(관리자만)

### Phase 5 — SLA 지연 추적
"계약 후 온보딩은 3일 내 킥오프" 원칙을 데이터로 감시.

```
STAGE_SLA_DAYS = { ONBOARDING: 3, KEYWORD: 7, GEO: 7, CONTENT: 14, LIVE·PAUSED·CHURNED: 없음 }
computeStageSla(stage, since, now) → { daysInStage, status: ok|warn|breach, overdueDays }
  경계: 지연 = 경과일 ≥ 한도,  임박 = 마감 하루 전
  since = stageUpdatedAt ?? createdAt  (전이 기록 없으면 생성 시각)
```

- 칸반 보드: 상단 `SLA 지연 N곳` 요약 + 카드별 `지연/임박` 배지
- 거래처 상세: 단계바 헤더 배지

---

## 3. GEO 측정 모듈 (7단계의 실체)

7단계 "GEO 측정"은 별도 모듈로 깊게 구현됐다. SEO와 연결선상에 두되 분리 진행.

- **측정 지표**: AI 답변 인용/언급률 — 4+ 엔진(ChatGPT·Gemini·Claude·Perplexity·AI Overview·NAVER AI)에서
  브랜드가 답변에 등장/인용되는 비율
- **통계 정합**(논문 근거): 반복 측정 ≥7회 다수결, Wilson 95% 신뢰구간, 단일값이 아닌 분포로 표현
- **충실성**: `claimSupported`(주장 근거 여부)·`citationPosition`(인용 위치)·`answerShare`(답변 비중) 캡처
- **일별 시계열**: `GeoCitationScore` 스냅샷 → 인용률 추세 그래프(신뢰구간 밴드 포함)
- **자동화**: `runGeoWatch`가 주 1회(월) 자동 관측 → **인용점수 재계산까지 연결**(그래프 자동 갱신)
- **수동 안내**: 자동 판정 불가한 충실성·비중은 수동 검수 대상으로 명시

문헌 검토: `docs/geo-literature-review.md` · 실무 매뉴얼: `docs/geo-practical-manual.md`

---

## 4. 자동화 백본 (크론)

`vercel.json`의 단일 일일 크론(매일 자정 UTC = 9시 KST)이 멱등 배치를 순차 실행한다.
배포돼 있으면 트래픽과 무관하게 상시 발화 — 별도 상시 서버 불필요.

| 잡 | 주기 | 내용 |
|----|------|------|
| 일일 알림 스위프 | 매일 | 마감·미수금 등 알림(중복 방지) |
| 월보장 순위 감시 | 매일 | 보장 키워드 이탈/미달/급락 알림 |
| 채널 동기화 | 매일 | GSC/GA4 → ChannelMetric upsert |
| 매거진 자동 초안 | 매일 | 큐 상위 N건 초안(발행은 사람 검토) |
| 반복 업무 생성 | 매일 | cadence 도래분 WorkItem 발행 |
| **GEO 자동 관측** | **주 1회(월)** | 엔진 질의 → 기록 → **인용점수 재계산** |

---

## 5. 남은 것 — 배포/운영 게이트 (코드 아님)

백본은 코드로 완성됐다. 아래는 운영 환경 설정이 필요한 항목이다.

- **라이브 API 키**: 네이버·Claude·Toss·Resend 실제 키를 Vercel env에 입력
  (어댑터·env 유무 체크 코드는 완비 — 키만 넣으면 실동작)
- **cron 상시 가동**: Vercel 배포 상태 유지(설정 자체는 완료)
- **부트스트랩 계정 교체**: 운영 전환 시 임시 관리자 제거

---

## 부록 — 핵심 파일

| 영역 | 경로 |
|------|------|
| 리드 상태머신 | `src/domain/sales/lead-stages.ts` |
| 거래처 상태머신 · SLA · 자동제안 | `src/domain/sales/client-stages.ts` |
| 여정 집계 | `src/server/repositories/journey.ts` |
| 단계 전이 액션 | `src/server/actions/clients.ts` |
| 단계바 UI | `src/components/clients/ClientStageBar.tsx` |
| 칸반 보드 | `src/components/clients/ClientBoard.tsx` |
| GEO 관측 러너 | `src/server/geo-engine/runner.ts` |
| GEO 인용점수 | `src/server/repositories/citation-score.ts` |
| 크론 진입점 | `src/app/api/marketing/cron/route.ts` |
