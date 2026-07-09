# 병원 광고대행사 Marketing OS — 업그레이드 계획서 (Phase별 상세)

작성일: 2026-07-09
기준 문서: `marketing_agency_os_planning_prompt.md`
대상 코드베이스: `marketing-agency-erp` (브랜치 `erp-v1`)
전제: **기존 프로젝트 유지 + 병원 버티컬 레이어 확장** (신규 재작성 없음)

---

## 0. 공통 원칙 (모든 Phase 적용)

- **비파괴 확장**: 기존 모델은 필드 추가만, 마이그레이션은 병존→점진 이전. 빌드시 `prisma db push` 비파괴 유지.
- **Source of Truth**: 병원 기준데이터(HospitalProfile)를 중심축으로, 모든 AI 생성물은 근거(sourceRefs)를 참조·표시.
- **사람 승인형 반자동**: AI는 초안/위험표시까지. 계약확정·의료법통과·거래처발송·지출결재는 사람 최종승인.
- **권한 우선**: 신규 화면마다 `authorization.ts` 헬퍼(requireRole/requireClientAccess)로 접근제어. 거래처 포털은 별도 경계.
- **독립 배포**: 각 Phase는 단독으로 배포 가능하도록 스키마·라우트를 격리.
- **모델 분리(비용)**: 검증·필드채움·상태변경=규칙기반, 문항/주제/보고서초안=중간 AI, 경쟁분석·키워드전략·의료법판단보조=Claude Opus.
- **디자인 톤**: 오렌지 브랜드(`#d9662e`) 일관 유지. 인포그래픽 중심(진행률·간트·순위그래프·병목알림).

---

## Phase 0 · 기반 안정화 (선행, 소규모)

**목표:** 확장 전 성능·멀티테넌시·업종구분 토대를 정리한다.

### 데이터 변경
- `Client` + `businessType` (enum `HOSPITAL | OTHER`, 기본 `HOSPITAL`)
- `Organization` / `orgId` 배선 점검 — 신규 모든 모델에 `orgId` 일관 부여 규칙 확정

### 작업
- **성능(TASK-019)**: Neon 서버리스 커넥션 풀링 어댑터 적용 → **Vercel 프리뷰에서 검증** 후 프로덕션.
- 거래처 등록/수정 화면에 업종 선택 추가(기본 병원).

### 수용기준 (AC)
- [ ] 거래처가 병원/기타로 구분되고 목록·상세에 표시된다.
- [ ] 프리뷰 배포에서 콜드스타트 후 대시보드 TTFB가 기존 대비 개선(측정치 기록).
- [ ] 신규 orgId 규칙 문서화, 기존 데이터 무손상.

### 리스크
- Neon 실환경은 프리뷰에서만 검증 가능(로컬은 localhost). → 프리뷰 우선 순서 고정.

---

## Phase 1 · Source of Truth (데이터 중심축) ★최우선

**목표:** "계약 내용이 설문·콘텐츠·업무·보고서로 자동 연결"되는 planning 핵심 축을 세운다. 최대 난공사(R1).

### 신규 모델
```
HospitalProfile
  id · clientId(unique) · departments(String[]) · doctors(Json)
  strengths(String) · cautionTerms(String) · preferredTone(String)
  prohibitedClaims(String) · competitorHospitals(Json)
  medicalLawNotes(String) · sotVersion(Int @default(1)) · updatedAt

Product (master)
  id · name · category(WorkCategory 재사용) · description
  defaultTasks(Json)          // 상품 계약시 자동 생성할 WorkItem 템플릿 목록
  defaultSurveyQuestions(Json)
  defaultReportMetrics(Json)
  isActive · sortOrder

ContractProduct              // 계약↔상품 브릿지 (R1 해결)
  id · contractId · productId · monthlyFee(Decimal) · adBudget(Decimal)
  quantity(Int) · notes
```

### 기존 변경
- `Contract`: 자유텍스트 `body`는 **병존 유지**. 상품은 `ContractProduct`로 구조화. `body`는 특약/메모 용도로 격하.
- `SotChangeLog`(선택): HospitalProfile 변경시 before/after 기록(AuditLog 재사용 가능하면 생략).

### 화면
- 거래처 상세에 **병원 프로파일 탭** (진료과·원장·강점·금지표현·선호톤·경쟁병원·의료법주의).
- 계약 화면 **상품 구성 UI**: 상품 마스터에서 선택 → 월단가·광고비·수량 입력 → 합계 자동.
- 설정 화면에 **상품 마스터 관리**(CRUD, 잠금/정렬).

### 서버액션
- `hospital-profile.ts`: get/upsert (권한: 거래처 접근권 + 관리자/담당자)
- `products.ts`: 마스터 CRUD (권한: ADMIN 이상)
- `contracts.ts` 확장: ContractProduct add/remove/update, 계약 확정시 `defaultTasks`로 WorkItem 자동 생성

### AC
- [ ] 상품을 계약에 붙이면 월단가·광고비 합계가 계산되고 계약금액에 반영된다.
- [ ] 계약 확정(SIGNED) 시 상품별 `defaultTasks`가 WorkItem으로 자동 생성된다.
- [ ] 병원 프로파일의 금지표현/선호톤이 저장되고 이후 AI 화면에서 조회 가능하다.
- [ ] 기존 계약 데이터가 마이그레이션 후에도 열람·수정 가능하다(무손상).

### 리스크 & 완화
- **R1 마이그레이션**: 기존 계약을 상품구조로 강제 이전하지 않고, 신규계약부터 구조화 + 기존은 `body` 병존. 점진 이전.

### 의존성
- Phase 0(업종구분) 완료 후 착수 권장.

---

## Phase 2 · 영업 파이프라인 (컨설팅 → 견적)

**목표:** planning §5.1 신규병원 영업 흐름. 병원명·주소 입력 → 키워드·경쟁·상권 분석 → 견적 3종.

### 신규 모델
```
Keyword
  id · clientId · keyword · intent · searchVolume(Int?) · trendRatio(Float?)
  priority(Int) · channel(enum BLOG|PLACE|POWERLINK|SEO|GEO|AEO) · source(수동/API)

ConsultingReport
  id · clientId · authorId · competitors(Json) · keywords(Json)
  marketAnalysis(String) · quoteRefs(String[]) · summary(String)
  webUrl(String?) · status(DRAFT|SHARED) · createdAt

Quote
  id · clientId · tier(enum BASIC|STANDARD|PREMIUM) · items(Json)
  totalAmount(Decimal) · validUntil · status(DRAFT|SENT|ACCEPTED|REJECTED)
```

### 화면
- **컨설팅 워크스페이스**: 병원명·주소·진료과 입력 → 키워드후보/경쟁병원/상권 요약(Claude) → 편집.
- **견적서 3종 생성**: 상품 마스터 기반 basic/standard/premium 자동 구성 → 금액 편집 → PDF/웹링크.
- 컨설팅 리포트 **웹 대시보드**(키워드·경쟁·상권·견적) — 거래처 공유용 단순화 뷰.

### 서버액션 / AI
- `consulting.ts`: 키워드후보 생성(Claude), 경쟁병원 분석요약(Claude), 리포트 저장.
- `quotes.ts`: 3종 생성/편집/발송, PDF(report-pdf.ts 재사용).
- 네이버 데이터랩/검색광고는 **연동 스텁**으로 두고, 값 없으면 수동입력. (실연동은 Phase 6)

### AC
- [ ] 병원명·주소 입력만으로 키워드 후보 10+개와 경쟁병원 요약 초안이 생성된다.
- [ ] 견적 3종이 상품 단가 기반으로 자동 산출되고 금액을 수정할 수 있다.
- [ ] 컨설팅 리포트를 웹링크/PDF로 공유할 수 있다.
- [ ] 네이버 데이터가 없을 때도 수동입력으로 흐름이 끊기지 않는다(검색량은 참조용 명시).

### 리스크
- AI 견적/키워드 정확도 → 사람 편집 필수, 네이버 상대값은 단독근거 금지 문구 표기.

---

## Phase 3 · 온보딩 자동화 (계약 → 설문)

**목표:** planning §5.2. 계약 상품 기반 설문 자동생성 → 발송 → 완료시 콘텐츠 태스크 자동생성.

### 신규 모델
```
Survey
  id · clientId · contractId · templateId(Product 참조) · title
  questions(Json)   // 상품 defaultSurveyQuestions 병합 결과
  sentVia(enum KAKAO|SMS|EMAIL|LINK) · status(DRAFT|SENT|COMPLETED)
  round(Int)        // 분기별 재설문
  publicToken(String unique)  // 외부 응답 링크
  createdAt · sentAt

SurveyResponse
  id · surveyId · answers(Json) · submittedAt
```

### 화면
- 계약 상세에서 **설문 자동생성** 버튼 → 상품별 문항 병합 → 담당자 확인/편집 → 발송.
- **외부 설문 응답 페이지**(公開 토큰, 로그인 불필요) — 병원 담당자가 링크로 응답.
- 설문 응답 결과 뷰 + 완료시 ContentPlan 태스크 자동생성 트리거.

### 서버액션
- `surveys.ts`: 생성(상품 문항 병합), 발송(알림톡 스텁→링크복사/문자 대체), 응답 수신, 상태전이.
- 응답 COMPLETED → ContentPlan 초안 task 자동 enqueue.

### AC
- [ ] 계약 상품에 따라 맞춤 설문이 자동 구성된다(병원정보/강점/금지표현/키워드/사진 등).
- [ ] 담당자 확인 후 공개 링크가 생성되고, 외부에서 로그인 없이 응답 가능하다.
- [ ] 설문 완료 시 콘텐츠 기획 태스크가 자동 생성된다.
- [ ] 분기별 재설문(round 증가)이 가능하다.

### 리스크
- 알림톡 비즈메시지 승인 절차 → MVP는 링크복사/문자 대체 발송. (실연동 Phase 6)
- 공개 응답 페이지 보안 → 토큰 만료·1회성 옵션.

---

## Phase 4 · 콘텐츠 + 컴플라이언스 ★병원 핵심

**목표:** planning §D + §8. 콘텐츠 기획 + 의료법 "위험표시 + 사람 승인" 2단 구조.

### 신규 모델
```
ContentPlan            // AiContent를 "기획 엔티티"로 승격
  id · clientId · contractId · month · keywordId · topic · angle
  faq(Json) · qa(Json) · complianceRisk(Json) · status(PLANNED|DRAFTED|REVIEWED|APPROVED|PUBLISHED)
  sourceRefs(Json)     // 근거 데이터 참조

ComplianceCheck
  id · targetType · targetId · riskFlags(Json)   // 의료법 §56 14개 유형 기준 (부록 E.2)
  ruleHits(Json)      // 규칙엔진 1차 탐지(금지어 사전·정규식) — 저비용
  aiSummary(String)   // Claude 2차 판단보조(애매한 것만)
  reviewerId · humanApproved(Boolean) · reviewedAt

MediaReviewSubmission        // §57 사전심의 관리 (리서치 반영, planning 미포함)
  id · clientId · contentPlanId? · reviewBody(의사회/치과의사회/한의사회)
  reviewNumber(String) · approvedAt · expiresAt(승인일+3년)
  status(NOT_REQUIRED|PENDING|APPROVED|EXPIRED) · targetMedia(Json)

Approval               // 통합 승인 워크플로우
  id · targetType(CONTRACT|QUOTE|CONTENT|COMPLIANCE) · targetId
  requesterId · approverId · status(PENDING|APPROVED|REJECTED) · comment · approvedAt
```

### 기존 변경
- `AiContent` + `sourceRefs` + `complianceCheckId` (근거·컴플라이언스 연계).

### 화면
- **콘텐츠 기획 보드**: 월별/키워드별 계획 → AI 초안 → 상태전이.
- 원고 편집기에 **의료법 위험 하이라이트**(치료보장/최상급/후기성/가격할인 등 자동표시 + 근거).
- **승인 대기 목록**(관리자/팀장): 계약·견적·원고·컴플라이언스 통합 큐.

### 서버액션 / AI
- `content-plans.ts`: 기획 생성(Claude), FAQ/Q&A 생성, 상태전이.
- `compliance.ts`: 위험표현 탐지(Claude, **판단자 아님·표시자**), 사람 승인 기록.
- `approvals.ts`: 통합 승인 요청/처리, 승인전 게시 차단.

### AC
- [ ] 원고 초안에서 의료법 위험 표현이 자동 표시되고 근거가 제시된다.
- [ ] 사람 승인 없이는 콘텐츠가 PUBLISHED로 전이되지 않는다(2단 승인 강제).
- [ ] 모든 AI 생성물에 참조 근거(sourceRefs)가 표시된다.
- [ ] 승인 대기 목록에서 계약/견적/원고/컴플라이언스를 한 화면에서 처리한다.

### 리스크
- 의료법 오탐/미탐 → AI는 표시만, 최종책임은 사람. UI에 "AI 보조·최종판단 아님" 명시.

---

## Phase 5 · 보고 + 대시보드

**목표:** planning §5 대시보드. 월간보고서 계약연동 + 역할별 인포그래픽.

### 변경
- `Report` 확장: 상품별 metric(defaultReportMetrics) 연결, 순위기록(수동/CSV) 반영.
- (선택) 거래처 포털 역할(`CLIENT_PORTAL`) 최소 뷰: 승인요청·보고서·피드백만.

### 화면
- **관리자 전체 대시보드**: 병목·지연·컨펌대기·매출증대기회 인포그래픽.
- **담당자 개인 대시보드**: 본인 업무·일정·컨펌대기.
- **거래처별 프로젝트 대시보드**: 상품별 진행률·순위 그래프.
- 월간/주간/일일 진행률, 리스크 알림.

### AC
- [ ] 월간보고서가 계약 상품 metric과 연동되어 자동 초안이 생성된다.
- [ ] 관리자는 전체 병목/컨펌대기/리스크를 인포그래픽으로 본다.
- [ ] 담당자는 본인 업무만, 거래처는 승인·보고·피드백만 본다(권한 분리 검증).

### 리스크
- 거래처 포털 데이터 노출(R2) → 별도 세션경계·화이트리스트 필드만 노출.

---

## Phase 6 · 외부연동 실배선 (2차 로드맵)

**목표:** 스텁으로 있던 연동을 실호출로. planning §7 외부연동 검토 준수.

### 작업
- **네이버 데이터랩** 검색어 트렌드(일 1,000회 한도, 상대비율) — 컨설팅 키워드 보강.
- **네이버 검색광고 API** — 검색량/키워드도구(광고주 계정·키 필요).
- **카카오 알림톡/친구톡/문자** — 설문·보고서 발송(비즈메시지 승인 선행).
- **순위 확인** — 블로그/플레이스/파워링크: **수동입력·CSV·반자동**부터(크롤링 법적리스크 검토).
- (3차) 입출금 API, 마케팅 뉴스바, AI RAG, 자동 업셀링, 다지점 관리.

### AC
- [ ] 키를 넣으면 연동이 켜지고, 없으면 수동입력으로 폴백된다("키 넣으면 켜짐" 유지).
- [ ] 순위는 MVP에서 수동/CSV로 기록되고 그래프로 표시된다.
- [ ] 발송은 알림톡 미승인시 문자/링크로 안전 대체된다.

### 리스크
- 크롤링·약관·차단·법적리스크 → 공식 API 한정, 순위는 반자동 우선.

---

## 요약 · 우선순위 · 리스크 집중도

| Phase | 핵심 산출 | 난이도 | 리스크 |
|---|---|---|---|
| 0 | 업종구분 + 성능 | 낮음 | 프리뷰 검증 필요 |
| **1** | **HospitalProfile + 계약↔상품(R1)** | **높음** | **마이그레이션(집중)** |
| 2 | 키워드·컨설팅리포트·견적3종 | 중 | AI 정확도·네이버 상대값 |
| 3 | 설문 자동생성·발송·응답 | 중 | 알림톡 승인·공개페이지 보안 |
| 4 | ContentPlan·의료법·통합승인 | 높음 | 의료법 오탐(AI 표시만) |
| 5 | 보고서 연동·역할별 대시보드 | 낮음 | 거래처 포털 노출 |
| 6 | 네이버·카카오·순위 실연동 | 높음 | 크롤링 법적리스크 |

**전체 리스크 등급: 중.** 최대 위험은 Phase 1(R1)에 집중되며 비파괴 병존 전략으로 완화. 나머지는 가산적 저위험.

**다음 단계:** 이 계획서 확정 → Phase 0 또는 Phase 1 착수 결정.

---

# 부록 A · 역할 · 권한 매트릭스

planning §3(8개 역할)·§4.2(5단 권한) 요구. 현재 3역할(`SUPER_ADMIN`/`ADMIN`/`MARKETER`)을 확장한다.

## A.1 역할 정의 (현재 → 목표)

| 역할 | 현재 | 목표 | 비고 |
|---|---|---|---|
| 관리자/대표 | `SUPER_ADMIN` | 유지 | 전체 |
| 팀장 | ✗ | `TEAM_LEAD` 신규 | 소속팀 거래처·업무 |
| 영업/콘텐츠/원고/디자이너/광고운영 | `MARKETER` 통합 | 유지 + 직무태그 | 세부직무는 태그로, 권한은 담당자 공통 |
| 재무/정산 | ✗ | `FINANCE` 신규 | 계약금액·입출금·지출·세금계산서 |
| 거래처(고객) | ✗ | `CLIENT_PORTAL` 신규 | 외부 경계, 승인·보고·피드백만 |

## A.2 권한 매트릭스 (조회/수정 범위)

| 데이터 | 관리자 | 팀장 | 담당자 | 재무 | 거래처 |
|---|---|---|---|---|---|
| 전체 거래처 | ●RW | ▲팀 | ▲본인 | ○R | ✗ |
| 병원 프로파일 | ●RW | ▲팀 | ▲본인 | ✗ | ○본인병원 R |
| 계약·상품 | ●RW | ▲팀 R | ▲본인 R | ○금액 R | ○본인 R |
| 견적·컨설팅 | ●RW | ▲팀 | ▲본인 | ✗ | ○승인요청 |
| 업무·일정 | ●RW | ▲팀 | ▲본인 RW | ✗ | ✗ |
| 콘텐츠·원고 | ●RW | ▲검수 | ▲본인 RW | ✗ | ○컨펌 |
| 의료법 승인 | ●최종 | ●검수 | ▲요청 | ✗ | ✗ |
| 보고서 | ●RW | ▲팀 | ▲본인 | ○R | ○본인 R |
| 매출·정산·입출금 | ●RW | ✗ | ✗ | ●RW | ✗ |
| 피드백 | ●R | ▲팀 | ▲본인 | ✗ | ●작성 |

● 전체 · ▲ 범위한정 · ○ 제한조회 · ✗ 불가 · R 조회 · W 수정

> **보안 원칙(R2):** 거래처 포털은 내부 세션과 **별도 경계**. 화이트리스트 필드만 노출, 내부 메모·금액·타거래처 완전 차단.

---

# 부록 B · 전체 화면 목록 (planning §6)

| # | 화면 | 상태 | Phase | 역할 |
|---|---|---|---|---|
| 1 | 로그인 | ✅ | - | 전체 |
| 2 | 관리자 대시보드 | ✅→확장 | 5 | 관리자/팀장 |
| 3 | 담당자 개인 대시보드 | ✅→확장 | 5 | 담당자 |
| 4 | 거래처 목록/상세 | ✅ | 0 | 내부 |
| 5 | **병원 프로파일 탭** | 🔴 | 1 | 내부 |
| 6 | **상품 마스터 관리** | 🔴 | 1 | 관리자 |
| 7 | 계약 목록/상세(+상품구성) | ✅→확장 | 1 | 내부/재무 |
| 8 | 전자서명 | ✅ | - | 내부 |
| 9 | **컨설팅 워크스페이스** | 🔴 | 2 | 영업 |
| 10 | **견적서 3종 생성** | 🔴 | 2 | 영업 |
| 11 | **컨설팅 리포트(웹)** | 🔴 | 2 | 내부/거래처 |
| 12 | **설문 생성/발송** | 🔴 | 3 | 담당자 |
| 13 | **외부 설문 응답 페이지** | 🔴 | 3 | 거래처(비로그인) |
| 14 | **콘텐츠 기획 보드** | 🔴 | 4 | 기획/원고 |
| 15 | 원고 편집기(+의료법 하이라이트) | 🟡 manuscript | 4 | 원고 |
| 16 | **승인 대기 통합 큐** | 🔴 | 4 | 관리자/팀장 |
| 17 | 업무 보드(칸반)·시간기록 | ✅ | - | 담당자 |
| 18 | 캘린더 | ✅ | - | 내부 |
| 19 | 월간 보고서 | ✅→확장 | 5 | 내부/거래처 |
| 20 | 주간 보고 | ✅ | - | 내부 |
| 21 | **거래처 프로젝트 대시보드** | 🔴 | 5 | 거래처 |
| 22 | 정산(청구·수금·지출) | ✅ | - | 재무 |
| 23 | 휴가·결재 | ✅ | - | 내부 |
| 24 | 파일함(보관함) | ✅ | - | 내부 |
| 25 | AI 스튜디오 | ✅ | - | 내부 |
| 26 | 이미지 스튜디오(+카드뉴스) | ✅ | - | 내부 |
| 27 | 회의록 | ✅ | - | 내부 |
| 28 | 외부연동 관리 | ✅→확장 | 6 | 관리자 |
| 29 | 설정 | ✅ | - | 관리자 |

✅ 완료 · 🟡 부분 · 🔴 신규 — **신규 화면 9개, 확장 6개.**

---

# 부록 C · 자동화 시나리오 → Phase 매핑 (planning §5)

| planning 시나리오 | 흐름 | 커버 Phase |
|---|---|---|
| §5.1 신규 병원 영업 | 병원입력→키워드·경쟁·상권→견적3종→리포트→공유 | **2** |
| §5.2 계약 후 온보딩 | 계약자동채움→서명→설문자동생성→발송→콘텐츠태스크 | **1·3** |
| §5.3 월간 운영 | 월간계획자동→원고초안→의료법체크→검수→컨펌→보고서 | **1·4·5** |
| §5.4 피드백 매출증대 | 피드백수집→분류→확장상품추천→업셀링알림→제안서 | **5(+3차)** |

---

# 부록 D · 개략 공수 추정 (견적 산정 참고)

> 상대 규모 기준(1인 개발자 기준 주 단위 개략치). 실제 견적은 팀 구성·연동 승인기간에 따라 변동.

| Phase | 규모 | 개략 공수 | 비고 |
|---|---|---|---|
| 0 | S | 0.5–1주 | 성능은 프리뷰 검증 포함 |
| **1** | **L** | **2–3주** | R1 마이그레이션 포함, 최대 |
| 2 | M | 1.5–2주 | AI 프롬프트 튜닝 포함 |
| 3 | M | 1.5–2주 | 공개 응답페이지·발송 대체 |
| 4 | L | 2–3주 | 의료법·통합승인 |
| 5 | M | 1.5–2주 | 인포그래픽 |
| 6 | L | 연동별 상이 | 카카오 비즈메시지 승인 대기 변수 큼 |
| **MVP(0~5)** | | **약 9–13주** | 6은 2차 |

**리스크 버퍼:** Phase 1·4·6에 각 +30% 권장(마이그레이션·의료법·외부승인 불확실성).

---

# 부록 E · 리서치 반영 & 추가 아이디어 (2026-07 조사)

planning 문서에 없던 실무·법규·트렌드를 웹 리서치로 보강. 병원 버티컬의 **차별화 핵심**이다.

## E.1 리서치 요약

| 주제 | 발견 | 시스템 반영 |
|---|---|---|
| **의료법 사전심의(§57)** | 직전 3개월 일평균 **10만 명↑ 매체(네이버·카카오·유튜브·틱톡)** 광고는 **사전심의 의무**. 유효기간 **3년**, 만료 6개월 전 재신청 | `MediaReviewSubmission` 신설 — 심의번호·만료 자동알림 |
| **의료법 금지유형(§56)** | **14개 유형** 명문화(치료경험담·최상급·비급여할인·환자유인 등) | ComplianceCheck riskFlags를 14유형으로 구조화(E.2) |
| **네이버 검색광고 API** | `/keywordstool` `relKwdStat` — `monthlyPcQcCnt`+`monthlyMobileQcCnt`(월 조회수)·연관키워드 | Keyword 실연동 스펙 구체화(Phase 6) |
| **리뷰가 순위·전환 직결** | 플레이스/구글 리뷰 평점·건수·최신성이 클릭·상담전환에 직접 영향 | **리뷰 모니터링 모듈** 신설 아이디어(E.3-②) |
| **채널 집중 전략** | 개원초=플레이스+블로그, 중대형=SEO 병행. 2~3채널 집중 후 확장 | **채널믹스 추천기**(E.3-④) |
| **AI 운영 레버리지** | 자동화 시 AM 1인당 **8~12 거래처**(기존 4~6). 온보딩 2주→3일 | **AM 부하 대시보드**·목표지표(E.4) |
| **에이전틱 스택 트렌드** | 오케스트레이션 + Claude 추론 + MCP 연결이 2026 표준 | 현재 구조(Server Actions+Claude)와 정합, MCP는 3차 |

## E.2 의료법 §56 14개 금지유형 → riskFlags 체크리스트

컴플라이언스 엔진의 **탐지 대상 사전(辭典)**. ①규칙엔진(금지어·정규식) 1차 → ②Claude 애매한 것만 2차 → ③사람 최종.

1. 미평가 신의료기술 광고
2. **치료경험담**(후기성 원고·환자 유도)
3. 거짓 광고
4. 비교 광고
5. 비방 광고
6. 시술행위 노출 광고
7. 부작용 정보 누락
8. **과장·최상급**('최초/최고/유일/완치/1시간 완치')
9. 근거 없는 자격·명칭 표방
10. 전문가 의견형태(신문 기사형) 광고
11. 미심의 광고
12. 외국인환자 유치 국내광고
13. **비급여 진료비 할인·면제 유인**
14. 상장·인증·보증·추천 광고

> **구현:** HospitalProfile.prohibitedClaims(거래처별 금지어) + 위 14유형 공통사전을 규칙엔진에 주입. 저비용 1차 필터로 대부분 걸러 Claude 호출 최소화(모델 쪼개기 원칙 부합).

## E.3 추가 기능 아이디어 (planning 미포함 · 우선순위 표시)

| # | 아이디어 | 근거 | 우선 | Phase |
|---|---|---|---|---|
| ① | **사전심의 관리** — 심의번호·유효기간 3년·만료 6개월전 알림·콘텐츠↔심의 연결 | §57 | **높음** | 4 |
| ② | **리뷰 모니터링/응대** — 플레이스·구글 리뷰 수집→부정리뷰 알림→긍정리뷰 카드뉴스 재활용 | 리뷰=전환직결 | **높음** | 5·6 |
| ③ | **컴플라이언스 규칙엔진** — 14유형 금지어 사전 1차 필터(AI 전) | 비용·정확도 | **높음** | 4 |
| ④ | **채널믹스 추천기** — 규모·진료과 입력→핵심채널 2~3개 추천 | 채널전략 | 중 | 2 |
| ⑤ | **AM 부하 대시보드** — 담당자당 거래처 수 8~12 목표 대비 모니터링·재배분 경보 | 운영 레버리지 | 중 | 5 |
| ⑥ | **경쟁병원 주간 모니터링** — 경쟁사 콘텐츠 변화 자동 요약(Claude) | 에이전트 활용 | 중 | 2·6 |
| ⑦ | **콘텐츠 재활용 파이프라인** — 긍정리뷰→카드뉴스→블로그→SNS 자동 승격 | 자산화 | 낮음 | 4·5 |
| ⑧ | **온보딩 진행률 트래커** — 계약→설문→콘텐츠 착수까지 3일 목표 SLA 표시 | 온보딩 단축 | 낮음 | 3 |
| ⑨ | **비급여 가격표현 자동 마스킹 경고** — 할인·이벤트 문구 실시간 차단 | §56-13 | 중 | 4 |

## E.4 목표 지표 (KPI) — 시스템 성공 기준

| 지표 | 현재(추정) | 목표 | 근거 |
|---|---|---|---|
| AM 1인당 관리 거래처 | 4~6 | **8~12** | AI 자동화 레버리지 |
| 신규 온보딩 소요 | 2주 | **3일** | 계약→설문→콘텐츠 자동연결 |
| 의료법 위반 사전 차단율 | 수동 | **AI+규칙 1차 100% 표시** | §56·§57 |
| 반복 입력 | 다수 | **0**(Source of Truth) | planning 핵심 원칙 |

## E.5 출처

- [대한의사협회 의료광고 규정](https://www.admedical.org/guide/regulations.do) · [의료법 §57 심의](https://casenote.kr/%EB%B2%95%EB%A0%B9/%EC%9D%98%EB%A3%8C%EB%B2%95/%EC%A0%9C57%EC%A1%B0) · [의료법 §56 금지](https://www.law.go.kr/LSW//lsLawLinkInfo.do?lsJoLnkSeq=900350305&lsId=001788&chrClsCd=010202&print=print)
- [2026 의료광고 심의 가이드(인블로그)](https://inblog.ai/ko/blog/medical-ad-review) · [금지 표현 사례(한의신문)](https://www.akomnews.com/bbs/board.php?bo_table=news&wr_id=41426) · [유형별 체크리스트(메디칼타임즈)](https://www.medicaltimes.com/Mobile/News/NewsView.html?ID=1162255)
- [네이버 검색광고 API 문서](https://naver.github.io/searchad-apidoc/) · [relKwdStat 사용법](https://workingwithpython.com/naverkeywordplannerapi/)
- [Agency onboarding with AI 2026](https://www.get-ryze.ai/blog/agency-onboarding-new-ad-clients-with-ai) · [Agentic marketing agency 구축 가이드](https://refreshagent.com/resources/how-to-use-ai-agents-marketing-agency) · [병원 마케팅 채널 전략(애드윈)](https://www.adwin01.com/)

---

# 부록 F · 코워크(Cowork) 비교분석 & 하이브리드 통합

실사용 중인 코워크(대화형 AI 오퍼레이터)와 우리 ERP를 비교. **경쟁이 아니라 역할 분담** — 코워크=AI 실행엔진, ERP=시스템 오브 레코드.

## F.1 성격 비교

| 항목 | 코워크 | 우리 ERP |
|---|---|---|
| 본질 | 대화형 AI 실행 도구(on-demand) | 구조화 운영 시스템(SoT) |
| 저장 | Airtable·문서(외부·휘발) | Postgres SoT(내장·영속) |
| 권한/역할 | 없음(사용자=전권) | 8역할 권한 매트릭스 |
| 승인 | 없음(사람 판단) | 의료법 2단 승인 강제 |
| 트리거 | 사람 프롬프트 | 계약→설문→콘텐츠 자동연결 |
| 반복 | **cron 스케줄** ✅ | 요청기반(약함) |
| 산출물 | **PPT·DOCX·스키마코드** ✅ | PDF·웹 대시보드 |
| 정산/감사 | 없음 | 청구·수금·지출·AuditLog |

## F.2 코워크가 드러낸 우리 계획의 gap 4개 → Phase 반영

| gap | 코워크 사례 | 반영 위치 | 신규 요소 |
|---|---|---|---|
| **G1. GEO/AEO 측정** | "GEO 점수 측정하고 지난달 비교" | **Phase 2·5** | `VisibilityScore`(clientId·channel·geoScore·seoScore·measuredOn) — AI 검색 가시성 추적·월비교 |
| **G2. PPT/DOCX 산출** | "SEO 제안서 PPT" "성과보고서 Word" | **Phase 2·5** | 견적/컨설팅/보고서에 pptx·docx export 추가(기존 PDF 외) |
| **G3. cron 정기 리포팅** | "매월 1일 자동 리포트" | **Phase 5·6** | `ScheduledJob`(kind·cron·clientId·lastRun) — 월간보고 자동생성 잡 엔진 |
| **G4. 배치 콘텐츠 생성** | "블로그 20편 주제" "4편 동시" | **Phase 4** | ContentPlan 배치 생성(주제 대량 매핑 + 동시 초안) + schema.org 코드 산출 |

> G1(GEO 측정)은 planning이 GEO/AEO를 "채널"로만 두고 **측정을 빠뜨린** 부분을 코워크가 정확히 보완. **차별화 가치 큼.**

## F.3 하이브리드 통합 아키텍처 (권장)

```
ERP(시스템 오브 레코드)  ──호출──▶  코워크/AI 실행엔진(진단·배치콘텐츠·PPT)
   │  SoT·권한·승인·정산·감사              │  종합진단·GEO측정·문서생성
   ◀──────────────수신(결과 저장)──────────┘
```

- **Airtable → ERP 흡수**: 코워크가 Airtable에 쌓던 클라이언트 DB를 우리 SoT가 대체. 코워크 온보딩 진단 결과를 ERP `ConsultingReport`/`VisibilityScore`로 수신.
- **역할 분담**: 창의·탐색·일회성=코워크 / 기록·통제·연결·법규승인=ERP.
- **연동 방식(3차)**: MCP 또는 웹훅으로 코워크 산출물을 ERP가 수신·구조화. Phase 6에서 검토.

## F.4 판단

**ERP 구축 유지가 정답.** 코워크는 우리가 못하는 SoT·승인·정산을 대체 못 하고, 우리는 코워크 강점(GEO·PPT·스케줄·배치)을 **기능으로 흡수 or 연동**하면 됨. 두 gap 중 G1(GEO 측정)·G2(PPT)는 MVP 가치가 높아 Phase 2/5에 우선 편입 권장.
