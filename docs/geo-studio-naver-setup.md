# GEO Studio · 네이버 실측 데이터 연동 가이드 (P2)

> 이 키를 넣으면 GEO Studio 화면의 검색량·SERP 배지가 🟡근사 → 🟢실측으로 **자동 전환**됩니다.
> 키가 없으면 자동으로 목(mock)으로 폴백하므로, 넣기 전에도 화면은 정상 동작합니다.

> **⚡ 이미 연동돼 있을 수 있음**: ERP `검색량 조회(/keywords)` 기능이 동일한
> `NAVER_CLIENT_ID/SECRET`(데이터랩)·`NAVER_AD_*`(검색광고)를 씁니다. GEO Studio 어댑터는
> 기존 `integrations/naver-datalab`을 **재사용**하므로, `/keywords`가 이미 실데이터로 나온다면
> **키 추가 없이 GEO Studio도 바로 실측**입니다. 확인: `/keywords`에서 검색 시 '데모 추정'
> 문구가 없고 실제 트렌드가 나오면 키가 이미 설정된 것.

## 1. 네이버 검색 API 키 발급 (무료)

1. https://developers.naver.com/apps/#/register 접속 (네이버 로그인)
2. **애플리케이션 등록**
   - 애플리케이션 이름: `VENOM ERP GEO` (자유)
   - 사용 API: **검색** 체크 (블로그·뉴스 등 SERP용)
   - **데이터랩(검색어 트렌드)** 도 사용하려면 별도 체크 (검색량 추이용)
   - 서비스 환경: **WEB**, 서비스 URL `https://erp.seokorea.org`
3. 등록 완료 → **Client ID**, **Client Secret** 확인

> 검색 API·데이터랩은 무료. 일 25,000회(검색)/1,000회(데이터랩) 한도. 초과 시 자동 목 폴백.

## 2. Vercel 환경변수 등록

Vercel → 프로젝트 → Settings → Environment Variables에 3개 추가:

| Key | Value |
|---|---|
| `NAVER_CLIENT_ID` | (발급받은 Client ID) |
| `NAVER_CLIENT_SECRET` | (발급받은 Client Secret) |
| `GEO_DATA_SOURCE` | `hybrid` |

저장 후 **재배포**(erp-v1 push 또는 Redeploy)하면 적용됩니다.

## 3. 동작 방식 (Charter §3·§4)

- `GEO_DATA_SOURCE=hybrid` + 키 있음 → **HybridProvider**: 검색량·SERP는 네이버 실측(🟢), 나머지(CEP·페르소나 등)는 목/AI.
- 키 없음 또는 `GEO_DATA_SOURCE=mock` → **MockProvider**: 전부 목(🟡근사).
- 실측 호출 실패(한도초과·오류) → 조용히 목 폴백. 화면 배지가 출처를 항상 정확히 표기.

## 4. 실측으로 켜지는 항목 (현재 어댑터)

| 데이터 | 소스 | 상태 |
|---|---|---|
| 검색량 추이 | 데이터랩 `POST /v1/datalab/search` | ✅ 어댑터 구현 |
| SERP 상위 URL | 블로그 `GET /v1/search/blog.json` | ✅ 어댑터 구현 |
| 연관 키워드 | (검색 API 미지원) | 목/AI 폴백 |
| 성별·연령 | (검색광고 API 별도 키 필요) | 목 폴백 |

> 연관어·CPC·성별연령까지 실측하려면 **네이버 검색광고 API**(별도 키)가 필요합니다 — 필요 시 P2.5로 추가.

## 5. 확인 방법

키 등록·재배포 후 `/geo-cep`에서 검색 실행 → **상위 URL 분석** 표의 배지가 `🟢 실측 · 네이버 실측`으로 바뀌고, URL이 실제 네이버 블로그 링크로 나오면 성공.

## 6. (선택) 절대 월간 검색수 — 네이버 검색광고 API

데이터랩(위)은 **상대 트렌드(0~100)** 만 줍니다. **실제 월간 검색수(PC/모바일/합계)** 는
별도의 **검색광고 키워드도구 API**(`api.searchad.naver.com/keywordstool`, HMAC 서명)에서
나오며 자격증명이 3개 필요합니다.

넣으면 **한 번에 실측 전환되는 곳**: `/keywords`(절대 검색수) · 컨설팅 리포트(거래처 키워드
월 검색량, DB 저장·고객 문서) · 거래처 인사이트 · GEO Studio `/geo-cep` 월 검색량 카드.

### 키 발급 (검색광고 계정 보유 시 5분)

1. https://searchad.naver.com 로그인 → **광고시스템**
2. **도구 → API 사용 관리**
3. **네이버 검색광고 API 라이선스** 발급 → 3개 확인:
   - 액세스 라이선스 → `NAVER_AD_API_KEY`
   - 비밀키(Secret Key) → `NAVER_AD_SECRET`
   - Customer ID(계정 ID) → `NAVER_AD_CUSTOMER_ID`

### Vercel 환경변수 추가 → 재배포

| Key | Value |
|---|---|
| `NAVER_AD_API_KEY` | 액세스 라이선스 |
| `NAVER_AD_SECRET` | 비밀키 |
| `NAVER_AD_CUSTOMER_ID` | Customer ID |

확인: `/keywords`가 PC/모바일/합계 실제 숫자로, `/geo-cep` 월 검색량 카드가 🟢`실측·네이버 검색광고`로 승격.
