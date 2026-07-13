# 마케팅 이미지 스튜디오 — 상세 작업 지시서 (v0.1)

작성일: 2026-07-13 · 대상: 개발팀(FE/BE/디자인/기획) · 기준 코드베이스: `recon9973-lang/marketing-agency-erp` (Next.js 15 App Router · Prisma · Neon Postgres · pnpm · Vercel)

> 이 문서는 미리캔버스/망고보드류의 **웹 기반 이미지 제작툴**을 현재 ERP 스택 위에 신규 모듈(`/studio`)로 구축·확장하기 위한 지시서다. 추상적 나열이 아니라, 각 기능의 **사용자 흐름 + 구현 고려사항 + 이 코드베이스에서의 재사용/신설 지점**을 함께 적는다.

## 0. 현재 코드베이스 컨텍스트 (그대로 재사용/주의할 것)

작업 전 반드시 인지할 실제 자산과 제약:

| 항목 | 현재 상태 | 이미지 스튜디오에서의 방침 |
|---|---|---|
| 인증 | NextAuth(이메일+소셜), `requireUser()`/`getCurrentUser()` | **재사용**. 신규 인증 만들지 말 것 |
| 멀티테넌시 | `Organization` 모델(= Workspace 역할), 사용자 역할 스코프(`buildClientWhere`) | Workspace 개념을 `Organization`에 매핑 |
| 파일 저장 | `StoredFile.data`가 **Postgres `Bytes`(BYTEA)** — S3 아님, `VaultFolder`로 폴더링 | ⚠️ **가장 큰 구조 변경 포인트.** 디자인 에셋/내보내기 산출물은 BYTEA로 두면 안 됨 → S3 호환 스토리지로 이전(§5.4) |
| 결제 | `/pay/[id]` 라우트 존재(국내 결제 흐름 일부) | 구독 결제는 이 흐름 확장 |
| 기존 스튜디오 | `/marketing-studio`(StudioClient), `/image-studio`(AI 생성, OpenAI), `/ai-studio`, `public/studio.html`(113KB 단독) | `/marketing-studio`를 **정식 캔버스 에디터로 승격**하거나 `/studio`로 신설 후 흡수. `image-studio`(AI 생성)는 에디터의 "AI 이미지" 소스로 통합 |
| 서버 액션 패턴 | `runAction`/`requireUser`/`ActionResult` (`src/server/actions/_helpers`) | 스튜디오 CRUD도 동일 패턴 |
| 마이그레이션 | `prisma/manual-migrations/YYYY-MM-DD_name.sql` 수동 SQL + Prisma generate | 동일 규칙으로 신규 테이블 추가 |
| 브랜드 | 오렌지 `#d9662e`, 다크/라이트 테마, 한국어 UI | 스튜디오 UI도 동일 톤 |

---

# 산출물 1 — 제품 기획서

## 1.1 제품 정의
- **제품명(임시):** 마케팅 이미지 스튜디오 (코드상 모듈명 `studio`)
- **한 줄 정의:** 비전문가 실무자가 **템플릿을 골라 텍스트/이미지만 바꿔** 5분 안에 고품질 마케팅 이미지를 뽑는 웹 SaaS.
- **형태:** 데스크톱 웹 우선 SaaS(반응형 지원, 편집은 데스크톱 최적화).
- **핵심 결과물:** PNG / JPG / WEBP / PDF, 카드뉴스 일괄 내보내기(ZIP), WEBP 일괄 변환/최적화.

## 1.2 문제 정의 & 가치
- 실무자는 포토샵/피그마를 못 쓰고, 외주는 느리고 비싸다.
- 미리캔버스/망고보드는 범용이라 **마케팅 특화 자동화**(카드뉴스 자동 분할, 브랜드킷 자동 적용, SNS 멀티사이즈 변환, WEBP 최적화)가 약하다.
- 본 제품은 **"템플릿 + 마케팅 자동화 + 최적화 파이프라인"** 3축으로 차별화(§산출물 12).

## 1.3 핵심 지표(North Star & 보조)
- **North Star:** 주간 "완성 내보내기(Export 성공)" 건수.
- 보조: 신규 가입→첫 내보내기까지 시간(목표 <5분), 템플릿→완성 전환율, WEBP 변환 도구 MAU, 프로젝트 재편집률.

## 1.4 범위 선긋기
- **포함:** 2D 정적 이미지 편집·내보내기·최적화, 다중 페이지(카드뉴스).
- **제외(당분간):** 영상/모션, 실시간 공동편집, 무한 캔버스, 인쇄 재단(CMYK)까지의 전문 인쇄.

---

# 산출물 2 — 주요 사용자 시나리오

각 시나리오는 **목표 → 흐름 → 이 제품이 줄여주는 마찰**로 기술.

### S1. 마케터 — 프로모션 카드뉴스 8장을 30분 안에
1. 대시보드 → "카드뉴스" 카테고리 템플릿 선택.
2. "긴 글 붙여넣기" 입력창에 기획 문구 800자 붙여넣기 → **자동 페이지 분할**로 8장 초안 생성.
3. 각 페이지 텍스트만 다듬고, 2장에 상품 이미지 교체(업로드/보관함).
4. 브랜드킷 적용(로고·컬러·폰트 원클릭) → 톤 통일.
5. 내보내기 모달 → "SNS 최적화 WEBP + 순번 파일명" → ZIP 다운로드.
- **줄인 마찰:** 페이지 수동 복제, 색/폰트 일일이 지정, 파일명 수동 정리.

### S2. 소상공인 — 오늘 저녁 이벤트 팝업을 직접
1. 템플릿 탐색 → "쇼핑몰 팝업" 필터 → 즐겨찾기 해둔 템플릿.
2. 상품 사진 1장 드래그 업로드 → **상품 이미지 기반 팝업 자동 생성**(§C).
3. "할인율/가격/기간" 마케팅 문구 템플릿에서 숫자만 입력.
4. PNG(투명 배경) 다운로드 → 쇼핑몰 관리자에 업로드.
- **줄인 마찰:** 레이아웃 감각 없이도 완성형 결과, 문구 포맷 고민 제거.

### S3. 콘텐츠 운영자 — 같은 디자인을 5개 채널 사이즈로
1. 인스타 피드(1080²) 썸네일 완성.
2. 우측 "사이즈 변환" → 인스타 스토리(1080×1920)·유튜브(1280×720)·블로그 대표(1200×630) 체크.
3. **동일 디자인 멀티사이즈 자동 리레이아웃**(요소 앵커 규칙 기반) → 각 사이즈 미세조정.
4. 전체 ZIP 내보내기(사이즈별 폴더/파일명).
- **줄인 마찰:** 사이즈별 재제작.

### S4. 실무자(비전문가) — 첫 방문 5분 온보딩
1. 가입 직후 "무엇을 만들까요?" 3개 카드(카드뉴스/SNS/썸네일).
2. 선택 시 바로 에디터 진입 + 코치마크 3단계(텍스트 더블클릭 수정 → 이미지 클릭 교체 → 다운로드).
3. 첫 내보내기 성공 시 축하 + "브랜드킷 만들기" 유도.

### S5. WEBP 변환만 필요한 사용자(에디터 없이)
1. 상단 "이미지 변환 도구" 진입(에디터 미경유).
2. 다중 파일 드래그 → 포맷(WEBP)·압축률·리사이즈·투명유지 설정.
3. 변환 전후 미리보기 + **예상 용량** 표시 → 일괄 처리 → ZIP.
- 이 도구는 **에디터와 독립**된 진입점으로, 유입/전환 훅.

---

# 산출물 3 — 핵심 기능 명세서

> 표기: **[MVP]** = 1차 필수, **[Post]** = 이후. 각 기능은 사용자 흐름·구현 고려사항 포함.

## A. 디자인 에디터

### A1. 캔버스 & 렌더링 [MVP]
- **흐름:** 프로젝트 열기 → 캔버스에 페이지 렌더 → 요소 클릭 선택 → 드래그/리사이즈/회전.
- **구현:** `react-konva`(Konva.js) 채택(§6 비교). Stage=뷰포트, Layer=페이지, Group/Node=요소. 좌표계는 **디자인 단위(px @ base scale)** 로 저장하고 화면 스케일은 Stage `scaleX/Y`로만 처리 → 저장 데이터는 해상도 독립.
- **주의:** Konva 노드에 앱 상태를 직접 두지 말고 **단일 소스(store)** → 노드는 파생. undo/redo·자동저장이 store 기준으로 단순해짐.

### A2. 텍스트 [MVP]
- 추가/더블클릭 인라인 수정, 폰트(웹폰트)·크기·색·굵기·정렬·**자간(letterSpacing)·행간(lineHeight)**.
- **구현:** Konva `Text`는 자간/리치텍스트가 약함 → **텍스트 편집 시 DOM `contentEditable` 오버레이**를 캔버스 좌표에 정합, 확정 시 Konva `Text`/`TextPath`로 커밋. 폰트는 웹폰트 프리로드 + `document.fonts.ready` 후 재측정(내보내기 시 폰트 미로드로 깨지는 사고 방지).
- 한글 폰트 서브셋팅(용량)·라이선스 표기 필수.

### A3. 이미지 [MVP]
- 업로드·드래그 배치·크롭·**마스크(도형/원형)**·불투명도·필터(밝기/대비). 배경제거 **[Post]**.
- **구현:** 업로드 즉시 **썸네일/프리뷰 생성**(§8). 크롭은 clip + 소스 rect. 원본은 스토리지, 캔버스엔 프리뷰 URL 사용(편집 경량화), 내보내기 시 원본 해상도로 스왑.

### A4. 도형·선·아이콘·스티커·프레임 [MVP: 도형/선, Post: 아이콘팩/스티커]
- 사각/원/삼각/다각형/선/화살표, 프레임(이미지 채우는 마스크 컨테이너).
- **구현:** SVG path 기반 벡터 요소. 아이콘은 라이선스 안전 팩(lucide/자체) 우선.

### A5. 레이어 패널·그룹·정렬·스냅 [MVP]
- 레이어 목록(순서 드래그, 잠금, 숨김), 그룹/해제, 스마트 가이드·스냅·간격 균등.
- **구현:** z-order = store 배열 순서. 스냅은 요소 bbox의 엣지/센터 후보를 임계값(±4px)으로 정렬 가이드 표시.

### A6. 히스토리·클립보드·줌 [MVP]
- Undo/Redo, 복사/붙여넣기(내부+시스템 클립보드 이미지 붙여넣기), 줌 10~400% + fit.
- **구현:** **불변 스냅샷 스택** 또는 커맨드 패턴. 자동저장·협업 확장을 감안하면 **패치(delta) 기반**(immer + JSON patch) 권장. 클립보드는 `navigator.clipboard` + 내부 버퍼 폴백.

### A7. 다중 페이지(카드뉴스) [MVP]
- 좌하단 페이지 썸네일 스트립: 추가/복제/삭제/순서변경, 페이지 간 요소 복붙.
- **구현:** `DesignPage[]` 배열, 각 페이지 독립 요소 트리. 썸네일은 저해상도 오프스크린 렌더 캐시(변경 시 무효화).

## B. 템플릿 시스템

### B1. 템플릿 라이브러리 [MVP]
- 카테고리(카드뉴스/SNS/인스타 피드·스토리/유튜브 썸네일/쇼핑몰 팝업/이벤트 배너/상세페이지 섹션), 검색, 필터(사이즈·색·업종), 즐겨찾기, 최근 사용.
- **흐름:** 탐색 → 미리보기 → "이 템플릿으로 시작" → 새 프로젝트로 **딥카피**(템플릿 원본 불변).
- **구현:** `Template.data`는 프로젝트와 **동일 JSON 스키마**(§8-데이터). 즐겨찾기/최근은 사용자별 조인 테이블 + 최근은 클라이언트 캐시 병행. 이 ERP엔 이미 `ClientFavorite`류 즐겨찾기 패턴/검색(⌘K) 인프라가 있어 재사용.

### B2. 쉬운 교체(플레이스홀더) [MVP]
- 템플릿 제작자가 요소에 **역할 태그**(`role: title|body|image|logo|cta|price`) 지정 → 사용자는 "여기 텍스트/이미지 교체" 힌트로 핵심만 수정.
- **구현:** `DesignElement.meta.role` 필드. 에디터가 role 있는 요소를 우측 "빠른 편집" 폼으로 요약 노출(전체 캔버스 안 만져도 완성).

## C. 마케팅 특화 기능 (차별화 핵심)

### C1. 카드뉴스 자동 분할 [MVP 축소판]
- **흐름:** 긴 글 붙여넣기 → 문단/문장 경계로 페이지당 글자수 규칙 분할 → N장 자동 생성(표지+본문+마무리 CTA 옵션).
- **구현:** MVP는 규칙 기반(문장 분리 + 페이지당 최대 글자/줄 수, 제목 자동 추출). 텍스트 넘침 시 자동 축소 폰트(auto-fit). AI 요약 분할은 [Post](§image-studio의 LLM 재사용).

### C2. 브랜드킷 [MVP]
- 로고(여러 버전)·브랜드 컬러 팔레트·폰트·기본 CTA 스타일 저장 → 에디터 좌측 "브랜드" 탭에서 원클릭 적용.
- **구현:** `BrandKit` per Organization. "적용" = 선택 요소/페이지에 컬러·폰트 스와핑 매핑. **거래처(Client) 단위 브랜드킷**으로 확장 시 ERP와 강력히 연동(차별화).

### C3. CTA/마케팅 문구 템플릿 [MVP 일부]
- 자주 쓰는 CTA 버튼 스타일 저장, 할인율/가격/기간/D-day 등 **문구 프리셋**(변수 채우기식).
- **구현:** 문구 프리셋 = `{template: "지금 {할인율}% 할인", vars:[...]}`. 가격/날짜 포맷터 내장(₩, 오늘+N일).

### C4. 멀티사이즈 자동 변환 [MVP: 프리셋 리사이즈 / Post: 스마트 리레이아웃]
- SNS 플랫폼별 권장 사이즈 프리셋, 동일 디자인 → 여러 사이즈 복제.
- **구현:** MVP는 지정 사이즈로 캔버스 리사이즈 + **요소 앵커/비율 규칙**(중앙정렬·상하 앵커·안전영역)으로 재배치. 완벽 자동은 어려우니 "자동 배치 후 사용자 미세조정" 전제로 설계.

### C5. 상품 이미지 기반 팝업 자동 생성 [Post 초입은 MVP]
- 상품 사진 1장 → 배경/그라데이션·타이틀·가격·CTA를 얹은 팝업 후보 3안.
- **구현:** MVP=레이아웃 프리셋에 이미지/문구 슬롯 매핑. 배경제거·색추출은 [Post].

### C6. A/B 버전 복제 [MVP 간단판]
- 페이지/프로젝트 복제로 문구·이미지 버전 분기, 버전 라벨.

## D. 이미지 변환·최적화 (독립 도구 + 내보내기 내장)

### D1~D9 통합 명세 [MVP]
- 기능: PNG/JPG/WEBP 변환, **WEBP 일괄 변환**, 압축률 조절, 투명 유지 여부, 리사이즈, **예상 용량 표시**, 변환 전후 미리보기, 다중 업로드 일괄 처리, **결과 ZIP**.
- **흐름:** 변환 도구 진입 → 파일 드롭(다중) → 옵션 → 미리보기/용량 → 실행 → 진행률 → ZIP.
- **구현(중요, §6.5 비교 결론):**
  - **소량·즉시:** 브라우저에서 `OffscreenCanvas` + `canvas.convertToBlob({type:'image/webp', quality})` (Web Worker). 서버 왕복 0, 프라이버시 우수.
  - **대량·고품질·PDF:** 서버 `sharp`(WEBP/AVIF/리사이즈/압축) + `pdf` 합성, **BullMQ 큐 + 워커**로 처리(§5.6). 30장+·수십MB는 서버로.
  - 라우팅 규칙: 파일 수·총용량 임계값으로 클라/서버 자동 선택. 예상 용량은 샘플 인코딩 또는 경험식으로 추정.

## E. 내보내기 [MVP]
- PNG/JPG/WEBP/PDF, 개별 페이지·전체 ZIP, **순번 파일명 자동**(`{project}-01.webp`), 고해상도(2x/3x) 옵션, 투명 배경, SNS 최적화 프리셋.
- **흐름:** 다운로드 버튼 → 모달(포맷·범위·해상도·배경·최적화) → (경량)즉시 / (무거우면)`ExportJob` 생성 → 완료 알림/다운로드.
- **구현:** 캔버스 렌더는 **폰트·이미지 로드 완료 후** 오프스크린 고배율 렌더 → blob. PDF는 페이지별 이미지 합성. 서버 렌더(폰트 일관성) vs 클라 렌더(빠름) 병행: 기본 클라, 대량/PDF는 서버.

---

# 산출물 4 — 화면별 UX/UI 구성안

## 4.1 공통 레이아웃/원칙
- 브랜드 오렌지 `#d9662e`, 다크/라이트, 한국어. 데스크톱 우선(에디터는 ≥1280px 최적, 그 이하 경고/제한).
- 원칙: **5분 첫 성공**, 템플릿→수정→다운로드 3스텝, 주요 CTA 강조, 기능 점진 노출.

## 4.2 화면 목록

### (1) 대시보드
- 상단: "무엇을 만들까요?" 퀵스타트 3카드(카드뉴스/SNS/썸네일) + "빈 캔버스".
- 최근 프로젝트 그리드(썸네일·수정시각), 즐겨찾기 템플릿, "이미지 변환 도구" 바로가기.

### (2) 템플릿 탐색
- 좌: 카테고리 트리 + 사이즈/색/업종 필터. 상단: 검색. 본문: 마소니 그리드, 호버 미리보기, 즐겨찾기 하트, "이 템플릿으로 시작".

### (3) 프로젝트 목록
- 리스트/그리드 토글, 정렬(수정일/이름), 검색, 복제/삭제/이름변경, 폴더(선택).

### (4) 디자인 에디터 (핵심)
```
┌───────────────────────────────────────────────────────────┐
│ 상단바: [파일명▾] 저장상태(자동저장됨)  ⟲⟳  [공유] [다운로드▉] │
├──────┬──────────────────────────────────────────┬──────────┤
│ 좌측 │                                          │  우측     │
│ 탭   │            중앙 캔버스 (줌/팬)             │ 속성 패널 │
│ 템플릿│                                          │ (선택요소 │
│ 요소 │                                          │  기반     │
│ 텍스트│                                          │  동적)    │
│ 업로드│                                          │           │
│ 브랜드│                                          │           │
│ 배경 │                                          │           │
├──────┴──────────────────────────────────────────┴──────────┤
│ 하단: [페이지1][페이지2][+]  썸네일 스트립 · 페이지 관리      │
└───────────────────────────────────────────────────────────┘
```
- 좌측: 탭 전환형(템플릿/요소/텍스트/업로드/브랜드/배경). 우측: 선택 없으면 페이지 속성(사이즈/배경), 요소 선택 시 해당 속성(텍스트면 폰트/자간/행간 등).
- 빈 상태 코치마크 3단계. 저장상태는 "저장 중…/자동 저장됨 · 오프라인 경고".

### (5) 이미지 변환 도구
- 에디터 미경유 독립 화면. 드롭존 → 파일 리스트(각 전/후·용량) → 옵션 사이드 → 일괄 실행 진행바 → ZIP.

### (6) 브랜드 키트 관리
- 로고 업로드(라이트/다크/심볼), 컬러 팔레트 편집, 폰트 선택, CTA 스타일 프리셋, 미리보기. (거래처별 킷은 ERP 연동 시.)

### (7) 내보내기 모달
- 포맷·범위(현재/전체)·해상도(1x/2x/3x)·배경(투명)·최적화(SNS 프리셋)·파일명 규칙 미리보기 → 다운로드/큐.

### (8) 로그인/회원가입
- 기존 NextAuth 재사용, 이메일+소셜. 가입 직후 온보딩(§S4)로 연결.

### (9) 요금제
- Free/Pro/Team 비교표, 사용량(내보내기·저장용량·워터마크) 차등, 결제(§5.5).

---

# 산출물 5 — MVP 개발 범위

## MVP 필수(1차)
1. 가입/로그인(기존 재사용) + 스튜디오 온보딩.
2. 템플릿 목록/탐색/즐겨찾기/최근.
3. 기본 에디터: 캔버스, 선택/이동/리사이즈/회전, 레이어, undo/redo, 줌, 스냅.
4. 텍스트/이미지/도형 편집(자간·행간 포함).
5. 다중 페이지 카드뉴스 + 자동 분할(규칙 기반).
6. 이미지 업로드(→ S3, 썸네일 생성).
7. 내보내기 PNG/JPG/WEBP + 전체 ZIP + 순번 파일명.
8. 프로젝트 저장/불러오기 + **자동 저장**.
9. WEBP 변환 도구(독립) — 클라 처리 + 대량 시 서버 큐.
10. 브랜드킷(로고/컬러/폰트) 기본.

## MVP 이후
- AI 문구 생성·AI 이미지(기존 `image-studio` LLM/이미지 재사용), 배경 제거, 스마트 멀티사이즈 리레이아웃, 실시간 협업/댓글, 관리자 템플릿 마켓, 결제/구독 고도화, SNS 직접 업로드, PDF 고급(재단/인쇄).

## MVP 완료 정의(DoD)
- 신규 사용자가 템플릿→수정→WEBP ZIP 다운로드까지 **5분 내** 성공.
- 10페이지 카드뉴스 편집 시 프레임드랍 없이 조작(§8).
- 자동저장 유실 0(네트워크 끊김 복구 포함).

---

# 산출물 6 — 추천 기술 스택

## 6.1 프론트엔드
- **Next.js 15 App Router + React 19**(현 스택 유지). 에디터는 클라이언트 컴포넌트 격리, 무거운 번들은 동적 import.
- 상태: 에디터 문서 상태는 **Zustand + immer**(패치/undo 용이), 서버 상태는 기존 서버액션/`ActionResult`.

## 6.2 캔버스 라이브러리 비교 → **Konva.js(react-konva) 채택**
| 기준 | Konva.js | Fabric.js | 커스텀(WebGL/PixiJS) |
|---|---|---|---|
| React 통합 | ★ `react-konva` 공식, 선언적 | 명령형, 래핑 필요 | 직접 구현 |
| 레이어/노드 모델 | 명확(Stage/Layer/Group) | 객체 캔버스 | 자유/고비용 |
| 성능(수십 노드) | 좋음, 레이어 캐싱 | 보통 | 최고, 개발비 큼 |
| 텍스트/리치 | 기본, 오버레이 보완 필요 | 상대적 강함 | 직접 |
| 학습/생산성 | 높음 | 높음 | 낮음 |
| 결론 | **채택** | 대안 | 오버킬 |
- **판단:** React 친화·레이어 모델·성능/생산성 균형에서 Konva 우위. 텍스트 자간/편집 약점은 **contentEditable 오버레이**(§A2)로 보완. Fabric은 명령형이라 React 상태·undo 통합 비용↑.

## 6.3 백엔드
- **Next.js API Routes + Server Actions**(현 패턴 유지). 별도 NestJS는 운영복잡도↑ → 도입 안 함.
- 무거운 작업(대량 변환·PDF·서버 렌더)만 **분리된 워커 프로세스**(BullMQ)로.

## 6.4 데이터/스토리지
- DB: **PostgreSQL(Neon) + Prisma**(유지).
- 파일: ⚠️ 현재 `StoredFile.data = Bytes(BYTEA)`는 이미지 스튜디오에 **부적합**(원본/내보내기 대용량, DB 비대·성능·비용). → **S3 호환 오브젝트 스토리지**(AWS S3 / Cloudflare R2 / Supabase Storage) 도입. `StoredFile`은 소형 문서용으로 유지, 스튜디오 에셋은 신규 `UploadedAsset`(키/URL만 DB). 업로드는 **presigned URL 직업로드**(서버 대역폭 절약).

## 6.5 이미지 처리(브라우저 vs 서버)
| 상황 | 방식 | 근거 |
|---|---|---|
| 소량·즉시 변환/내보내기 | **브라우저** `OffscreenCanvas`+Worker, `convertToBlob` | 왕복 0, 프라이버시, 서버 비용↓ |
| 대량 WEBP/AVIF·리사이즈·압축 | **서버 `sharp`** + 큐 | 품질/속도/일관성, 브라우저 메모리 한계 회피 |
| PDF·서버 렌더(폰트 일관성) | **서버**(`sharp`+pdf, 또는 `satori`/헤드리스) | 폰트/렌더 결정성 |
- ZIP: 클라 `flt/zip.js` 또는 서버 `archiver`.

## 6.6 큐/잡
- **BullMQ + Redis(Upstash 등 서버리스 Redis)**. `ExportJob`/대량 변환을 큐잉, 워커가 처리 후 상태·결과 URL 갱신, 클라는 폴링/SSE로 진행률.

## 6.7 인증/결제
- 인증: **NextAuth 유지**(이메일+소셜).
- 결제: **국내(토스페이먼츠/아임포트)** 우선(현 `/pay` 흐름 확장), 해외 확장 대비 **어댑터 인터페이스**로 Stripe 교체 가능하게 추상화.

## 6.8 관측/운영
- 에러: Sentry. 내보내기 실패·큐 실패 알림. 사용량 로깅(§9 통계).

---

# 산출물 7 — 시스템 아키텍처

```
[브라우저]
  ├ Next.js(App Router) UI + 에디터(Konva, Zustand)
  ├ 소량 변환/내보내기: Web Worker(OffscreenCanvas)
  └ presigned URL로 S3 직업로드
        │  (Server Actions / API Routes)
        ▼
[Next.js 서버 (Vercel)]
  ├ 인증(NextAuth) · 권한(Org/Role 스코프)
  ├ 프로젝트/템플릿/브랜드킷 CRUD (Prisma → Neon)
  ├ presign 발급, 잡 enqueue
  └ SSE/폴링으로 잡 상태 반환
        │ enqueue
        ▼
[큐: Redis(BullMQ)]  ──►  [워커(별도 프로세스/컨테이너)]
                              ├ sharp 대량 변환/최적화
                              ├ 서버 렌더/PDF 합성
                              └ ZIP 패키징 → S3 결과 업로드 → DB 상태 갱신
[스토리지: S3 호환]  원본 에셋 · 프리뷰/썸네일 · 내보내기 산출물
[DB: Neon Postgres]  메타데이터 · JSON 문서(Project/Page/Element/Template)
```
- **저장 원칙:** 픽셀은 S3, 구조(JSON)·메타는 Postgres. 캔버스 문서는 해상도 독립 JSON.
- **확장:** 협업(Post)은 Yjs/CRDT + WebSocket 게이트웨이를 후단에 추가하는 구조로 여지 남김.

---

# 산출물 8 — 데이터베이스 모델 초안 (Prisma 기준)

> 이 ERP의 기존 `User`/`Organization`을 재사용. Workspace=Organization 매핑(별도 Workspace 도입은 선택). 마이그레이션은 `prisma/manual-migrations/2026-XX-XX_studio_*.sql` 규칙.

```prisma
// Workspace = 기존 Organization 재사용 권장. 스튜디오 전용 설정만 분리하려면:
model StudioWorkspace {
  id        String   @id @default(cuid())
  orgId     String   @unique          // Organization 1:1
  planId    String?                    // SubscriptionPlan
  storageUsed BigInt @default(0)       // 바이트, 용량 정책
  createdAt DateTime @default(now())
  org       Organization @relation(fields: [orgId], references: [id])
  projects  Project[]
  assets    UploadedAsset[]
  brandKits BrandKit[]
}

model Project {
  id          String   @id @default(cuid())
  workspaceId String
  ownerId     String                    // User
  clientId    String?                    // (차별화) ERP 거래처 연동
  title       String   @default("제목 없는 디자인")
  kind        String                     // cardnews|sns|thumbnail|popup|banner|detail|blank
  canvasW     Int
  canvasH     Int
  thumbnailKey String?                   // S3 key(대표 썸네일)
  data        Json                       // 페이지/요소 전체 스냅샷(또는 정규화 시 DesignPage로)
  status      String   @default("DRAFT") // DRAFT|ARCHIVED
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  pages       DesignPage[]
  exports     ExportJob[]
  @@index([workspaceId, updatedAt])
  @@index([ownerId])
  @@index([clientId])
}

model DesignPage {
  id        String  @id @default(cuid())
  projectId String
  index     Int                          // 페이지 순서(카드뉴스 순번)
  name      String?
  width     Int
  height    Int
  background Json?                        // {type:color|image|gradient, ...}
  elements  Json                          // DesignElement[] (성능상 페이지당 JSON 권장)
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@unique([projectId, index])
  @@index([projectId])
}

// DesignElement: 성능/편의상 DesignPage.elements(JSON)로 임베드 권장.
// 정규화가 필요할 때(검색/부분수정)만 테이블화. JSON 스키마 예:
// {
//   id, type: "text|image|shape|line|icon|frame|group",
//   x, y, w, h, rotation, opacity, locked, visible, z,
//   meta: { role?: "title|body|image|logo|cta|price" },
//   // type별:
//   text?: { value, fontFamily, fontSize, color, bold, italic, align,
//            letterSpacing, lineHeight },
//   image?: { assetId, crop:{x,y,w,h}, mask?, filters?:{brightness,contrast} },
//   shape?: { kind, fill, stroke, strokeWidth, radius },
//   children?: [ ...elements ]  // group
// }

model Template {
  id          String  @id @default(cuid())
  categoryId  String
  title       String
  kind        String
  canvasW     Int
  canvasH     Int
  previewKey  String                       // S3 미리보기 이미지
  data        Json                          // Project.data와 동일 스키마
  tags        String[]                      // 색/업종/검색 태그
  isPublished Boolean @default(false)
  createdById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  category    TemplateCategory @relation(fields: [categoryId], references: [id])
  favorites   TemplateFavorite[]
  @@index([categoryId])
  @@index([isPublished])
}

model TemplateCategory {
  id        String @id @default(cuid())
  slug      String @unique                 // cardnews|sns|thumbnail...
  name      String
  order     Int    @default(0)
  templates Template[]
}

model TemplateFavorite {                    // 즐겨찾기(사용자별)
  id         String @id @default(cuid())
  userId     String
  templateId String
  createdAt  DateTime @default(now())
  @@unique([userId, templateId])
  @@index([userId])
}

model UploadedAsset {
  id          String  @id @default(cuid())
  workspaceId String
  uploaderId  String
  storageKey  String                        // S3 key(원본)
  previewKey  String?                        // 썸네일/프리뷰 key
  mimeType    String
  width       Int?
  height      Int?
  size        Int                            // 바이트
  kind        String  @default("image")      // image|logo|icon
  createdAt   DateTime @default(now())
  @@index([workspaceId, createdAt])
}

model BrandKit {
  id          String  @id @default(cuid())
  workspaceId String
  clientId    String?                        // (차별화) 거래처별 브랜드킷
  name        String
  logos       Json                           // [{key, variant:light|dark|symbol}]
  colors      Json                           // ["#d9662e", ...]
  fonts       Json                           // [{family, url?}]
  ctaStyles   Json?                          // 저장된 CTA 버튼 프리셋
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([workspaceId])
  @@index([clientId])
}

model ExportJob {
  id          String  @id @default(cuid())
  projectId   String
  requestedBy String
  format      String                          // png|jpg|webp|pdf|zip
  scope       String                          // current|all
  options     Json                            // {scale, transparent, quality, snsPreset, filenamePattern}
  status      String  @default("QUEUED")       // QUEUED|PROCESSING|DONE|FAILED
  progress    Int     @default(0)
  resultKey   String?                          // S3 결과(zip/pdf)
  error       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@index([projectId])
  @@index([status])
}

model SubscriptionPlan {
  id             String  @id @default(cuid())
  slug           String  @unique               // free|pro|team
  name           String
  priceMonthly   Int                            // 원
  maxStorageMB   Int
  maxExportsMo   Int?                           // null=무제한
  watermark      Boolean @default(true)
  features       Json
}
```
**관계 요약:** Organization(=Workspace) 1—N Project 1—N DesignPage(요소는 JSON 임베드). Template N—1 TemplateCategory, N—N User(즐겨찾기). Project 1—N ExportJob. Workspace 1—N UploadedAsset/BrandKit. Plan 1—N Workspace.

**정규화 판단:** `DesignElement`는 **JSON 임베드 권장**(편집 단위가 페이지 전체, 조인 폭증 방지). 요소 단위 검색/부분갱신 요구가 확정되면 그때 테이블화.

---

# 산출물 9 — API 목록 초안

> 규칙: 조회/뮤테이션은 기존 **Server Action(`runAction`+`requireUser`)** 우선, 파일/잡/외부연동은 **Route Handler**. 모두 Org/Role 스코프 적용.

### 인증/워크스페이스 (기존 재사용)
- `NextAuth` `/api/auth/*` — 유지.
- `getMyWorkspace()` (action) — 현재 사용자 워크스페이스/플랜/용량.

### 프로젝트
- `listProjects({q, sort, cursor})` · `getProject(id)` · `createProject({kind, canvasW/H, templateId?})`
- `renameProject(id, title)` · `duplicateProject(id)` · `deleteProject(id)`
- `saveProject(id, patch)` — **자동저장**(부분 패치, 낙관적 동시성 `updatedAt`/버전).

### 페이지
- `addPage` · `duplicatePage` · `deletePage` · `reorderPages(order[])` · `savePage(id, elements)`.

### 템플릿
- `listTemplates({categoryId, q, tags, cursor})` · `getTemplate(id)` · `startFromTemplate(templateId)`(딥카피→Project)
- `toggleTemplateFavorite(templateId)` · `listFavorites()` · `listRecentTemplates()`.

### 카드뉴스 자동 분할
- `POST /api/studio/autopaginate` `{text, perPageChars, style}` → 페이지 초안 배열.

### 업로드/에셋 (S3 presigned)
- `POST /api/studio/uploads/presign` `{filename, mime, size}` → `{uploadUrl, assetId, key}`
- `POST /api/studio/uploads/complete` `{assetId, width, height}` → 썸네일 잡 enqueue
- `listAssets({cursor})` · `deleteAsset(id)`.

### 이미지 변환 도구
- `POST /api/studio/convert` `{assets[], target:{format, quality, resize, keepAlpha}}`
  - 소량: 동기 응답(또는 클라 처리) / 대량: `ExportJob`류 잡 반환.
- `GET /api/studio/convert/:jobId` — 상태/진행률/결과 URL.

### 내보내기
- `POST /api/studio/exports` `{projectId, format, scope, options}` → `ExportJob`
- `GET /api/studio/exports/:id` (폴링) 또는 `GET /api/studio/exports/:id/stream`(SSE)
- 완료 시 `resultKey` presigned 다운로드 URL.

### 브랜드킷
- `listBrandKits` · `createBrandKit` · `updateBrandKit` · `deleteBrandKit` · `applyBrandKit(projectId|pageId, kitId)`.

### 결제/플랜
- `listPlans` · `POST /api/billing/checkout`(토스/아임포트) · 웹훅 `POST /api/billing/webhook`.

### 관리자 (권한 게이트)
- `admin.templates.*`(CRUD/발행) · `admin.categories.*` · `admin.users.*` · `admin.reports.*`(신고/저작권) · `admin.usage.stats` · `admin.plans.*`.

---

# 산출물 10 — 개발 단계별 로드맵

> 팀 규모 가정: FE 2 · BE 1~2 · 디자인 1 · PM 겸직. 기간은 상대적 스프린트(2주 단위) 추정.

| 단계 | 스프린트 | 내용 | 산출/게이트 |
|---|---|---|---|
| **P0 기반** | S1 | S3 스토리지 도입, `UploadedAsset` presign 업로드, 스튜디오 라우트 골격(`/studio`), 데이터 모델·마이그레이션 | 파일 업로드→S3→썸네일 표시 |
| **P1 에디터 코어** | S2~S3 | Konva 캔버스, 선택/변형, 텍스트(자간·행간)/이미지/도형, 레이어, undo/redo, 줌/스냅, Zustand 문서상태 | 빈 캔버스에서 요소 편집 |
| **P2 문서·저장** | S4 | 다중 페이지, 자동저장(패치·동시성), 프로젝트 목록/복제/삭제 | 10p 편집·새로고침 무손실 |
| **P3 템플릿** | S5 | 템플릿 라이브러리/카테고리/검색/즐겨찾기/최근, 딥카피 시작, 역할 태그 빠른편집 | 템플릿→수정 흐름 |
| **P4 카드뉴스·브랜드** | S6 | 자동 분할(규칙), 브랜드킷(로고/컬러/폰트) 적용, CTA/문구 프리셋 | S1 시나리오 완주 |
| **P5 변환·내보내기** | S7 | WEBP 변환 도구(클라+서버 큐), PNG/JPG/WEBP/PDF·ZIP·순번 파일명·고해상도·투명, `ExportJob`+워커 | S5 시나리오 완주, MVP DoD |
| **P6 안정화/요금제** | S8 | 성능 튜닝(§8), 에러/관측, 요금제·결제, 온보딩·코치마크, 관리자 최소 세트 | 베타 출시 |
| **Post** | S9+ | AI 문구/이미지(기존 재사용), 배경제거, 스마트 멀티사이즈, 협업/댓글, 템플릿 마켓, SNS 업로드 | 순차 |

병렬화: P0 진행 중 디자인은 템플릿 10~20종·아이콘/폰트 라이선스 확보를 선행.

---

# 산출물 11 — 예상 개발 난이도·리스크

| 영역 | 난이도 | 리스크 | 완화책 |
|---|---|---|---|
| 캔버스 에디터(변형/스냅/undo) | 높음 | 상태·Konva 노드 동기화 버그, 리렌더 성능 | 단일 store→노드 파생, 패치 기반 히스토리, 레이어 캐싱 |
| 텍스트 편집(한글 자간/행간/폰트) | 높음 | Konva 텍스트 한계, 내보내기 폰트 미로드로 깨짐 | contentEditable 오버레이, `document.fonts.ready` 후 렌더, 폰트 서브셋 |
| 이미지 파이프라인(클라/서버 경계) | 중~높음 | 브라우저 메모리 초과, 서버 비용, 예상용량 오차 | 임계값 라우팅, 큐+워커, 프리뷰/원본 분리 |
| 멀티사이즈 자동 리레이아웃 | 높음 | 완전 자동은 품질 불안정 | MVP는 앵커 규칙 + 사용자 미세조정 전제 |
| S3 전환(기존 BYTEA와 공존) | 중 | 두 저장소 혼재·마이그레이션 | 스튜디오는 신규 S3만, 기존 StoredFile은 유지·점진 이전 |
| 자동저장 동시성/유실 | 중 | 다중 탭·오프라인 충돌 | 낙관적 버전, 오프라인 큐, 저장상태 UI 명시 |
| 폰트/아이콘/템플릿 라이선스 | 중 | 저작권 클레임 | 상업용 라이선스만, 출처·라이선스 DB화(§9 admin.reports) |
| PDF/서버 렌더 폰트 일관성 | 중 | 브라우저/서버 렌더 결과 차이 | 내보내기 경로 표준화(대량·PDF는 서버) |
| 성능(10p·저사양) | 중 | 프레임드랍 | 오프스크린 썸네일 캐시, 가상화, 프리뷰 해상도 |
| 결제/구독 | 중 | 국내/해외 이원화 | 결제 어댑터 추상화 |

---

# 산출물 12 — 미리캔버스/망고보드 대비 차별화 제안

핵심: **범용 디자인툴이 아니라 "마케팅 운영에 붙는" 이미지 스튜디오.** 본 ERP와의 결합이 최대 무기다.

1. **거래처(Client) 브랜드킷 자동연동** — ERP의 거래처별 로고/컬러/톤을 브랜드킷으로 자동 주입. 대행사 실무자가 거래처만 고르면 그 브랜드로 카드뉴스가 뽑힌다. (범용툴은 브랜드를 매번 수동 설정.)
2. **콘텐츠/매거진 파이프라인 연동** — ERP `MagazinePost`·콘텐츠 기획 결과(문구)를 그대로 "긴 글 붙여넣기"에 흘려 **기획→카드뉴스→발행**을 한 라인으로. 승인함/보고서와도 연결.
3. **WEBP 최적화를 1급 기능으로** — 미리캔버스/망고보드가 약한 **일괄 WEBP/AVIF·압축·예상용량·ZIP**을 전면 배치. 쇼핑몰/블로그 실무의 "용량 최적화" 페인을 직격(독립 진입점으로 유입 훅).
4. **SNS 멀티사이즈 자동 변환 + 안전영역 가이드** — 플랫폼별 실측 권장 사이즈·안전영역 프리셋으로 한 번에 5채널 산출.
5. **마케팅 문구 변수 템플릿** — 할인율/가격/D-day를 변수로 채우는 문구 프리셋 + 자동 포맷(₩, 날짜). A/B 버전 복제 내장.
6. **역할 태그 기반 "빠른 편집"** — 템플릿의 title/image/price만 우측 폼으로 노출 → 비전문가가 캔버스를 거의 안 만지고 완성(첫 성공 5분 목표 달성).
7. **AI는 "붙이는" 방식** — 기존 `image-studio`(AI 이미지)·LLM을 에디터의 이미지/문구 소스로 통합(Post). 별도 제품이 아니라 흐름 안에 삽입.
8. **결과물의 마케팅 KPI 회수(장기)** — 내보낸 이미지가 어느 캠페인/거래처에 쓰였는지 ERP가 알기 때문에, 성과 데이터와 연결해 "잘 되는 템플릿"을 추천하는 루프(범용툴 불가능).

---

## 부록 A. 첫 착수 체크리스트(개발자용)
- [ ] S3 호환 버킷·자격증명 세팅(env), presign 유틸(`src/server/storage/s3.ts`).
- [ ] `prisma/manual-migrations/2026-XX-XX_studio_core.sql` 작성 → `StudioWorkspace/Project/DesignPage/Template/TemplateCategory/TemplateFavorite/UploadedAsset/BrandKit/ExportJob/SubscriptionPlan`.
- [ ] `/studio` 라우트 골격 + `react-konva`·`zustand`·`immer`·`sharp`(server)·`bullmq` 의존성 추가(pnpm).
- [ ] 에디터 문서 JSON 스키마 타입(`src/domain/studio/schema.ts`) 확정 — Project/Page/Element.
- [ ] 자동저장 서버액션(`saveProject`) + 낙관적 버전 필드.
- [ ] 코치마크·온보딩(첫 5분) 플로우.

## 부록 B. 비기능 요구(성능·품질) 수용 기준
- 에디터 최초 상호작용 가능(TTI) < 3초, 무거운 번들 동적 로드.
- 10페이지 편집 시 조작 60fps 목표(프리뷰 해상도·썸네일 캐시).
- 자동저장 백그라운드 처리(입력 방해 0), 실패 시 재시도+상태 표시.
- 내보내기 실패 시 원인별 한국어 에러(폰트/용량/네트워크) + 재시도.
- 업로드 후 썸네일 1~2초 내 표시(프리뷰 우선, 원본 후행).
