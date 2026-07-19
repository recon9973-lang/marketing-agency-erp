# VENOM ERP 운영 전환 런북 (Go-Live)

> 코드 백본은 완성됐다. 이 문서는 **운영 환경 설정만 하면 켜지는** 게이트들을 코드 기준으로
> 정리한다. 모든 변수명은 코드가 실제로 읽는 이름이다(`.env.example`과 일치).
> 설정 후 앱의 **`/integrations` 화면**에서 항목별 연결 상태를 최종 확인한다.

원칙: **"키를 넣으면 켜진다."** 키가 없으면 해당 기능만 데모/수동으로 안전 강등되고 앱은 계속 동작한다.

---

## Tier 1 — 필수 코어 (없으면 앱 미동작)

Vercel → Project → Settings → Environment Variables 에 입력.

| 변수 | 값 | 비고 |
|------|-----|------|
| `DATABASE_URL` | Neon pooled 연결 문자열 | 필수 |
| `DATABASE_URL_UNPOOLED` | Neon direct 연결 | `prisma db push`용 |
| `AUTH_SECRET` | `openssl rand -base64 32` | 세션 서명 |
| `AUTH_URL` | `https://erp.seokorea.org` | 배포 도메인 |
| `CREDENTIAL_ENC_KEY` | `openssl rand -hex 32` | 거래처 자격증명 암호화. **변경 금지**(변경 시 기존 복호화 불가) |
| `ADMIN_EMAIL` | 실제 관리자 이메일 | 최고관리자 자동 등록 |
| `ADMIN_PASSWORD` | 강한 비밀번호 | 초기 로그인. 로그인 후 앱에서 변경하면 DB 해시 우선 |

---

## Tier 2 — 운영 보안 잠금 (⚠️ 전환 시 필수)

코드에 **공용 부트스트랩 관리자**(`admin@venom.app`)가 있어 env와 무관하게 로그인된다.
초기 설치·잠금 방지용이므로, **운영 전환 시 반드시 차단**한다.

| 변수 | 운영 값 | 효과 |
|------|---------|------|
| `DISABLE_BOOTSTRAP_ADMIN` | `true` | 공용 백도어 차단 → `ADMIN_EMAIL`/`ADMIN_PASSWORD`(또는 DB 해시)로만 로그인 |
| `ALLOW_DEV_SESSION` | `false`(또는 미설정) | `?devRole=` 역할 전환 차단(로컬 전용 기능) |

**순서**: ① `ADMIN_EMAIL`/`ADMIN_PASSWORD`로 로그인 가능함을 먼저 확인 → ② `DISABLE_BOOTSTRAP_ADMIN=true`
설정 후 재배포 → ③ `/integrations`의 "부트스트랩 백도어 차단"이 **연결됨(초록)** 인지 확인.

> 확인 코드 경로: `src/server/auth.ts`의 `isBootstrapDisabled()` — 백도어를 완전히 우회한다.

---

## Tier 3 — 크론 (상시 자동화)

| 변수 | 값 | 효과 |
|------|-----|------|
| `CRON_SECRET` | 임의 시크릿 | 설정해야 Vercel Cron(매일 자정 UTC=9시 KST)이 401 없이 실행 |

크론 스케줄 자체는 `vercel.json`에 이미 등록됨. 배포 상태만 유지하면 상시 발화.
실행 잡: 일일 알림·월보장 순위감시·채널동기화·매거진 초안·반복업무 + **GEO 자동 관측(주1회 월)**.

---

## Tier 4 — 기능별 실측 키 (선택 · 넣는 만큼 켜짐)

없으면 해당 기능만 데모/수동으로 강등. 우선순위 순.

| 기능 | 변수 | 없을 때 |
|------|------|---------|
| Claude(컨설팅·콘텐츠·GEO답변) | `ANTHROPIC_API_KEY` | 생성 폼 미리보기만 |
| 이미지·전사 | `OPENAI_API_KEY` | 프롬프트 복사/메모 붙여넣기 |
| GEO 4-AI 엔진 | `PERPLEXITY_API_KEY`, `GOOGLE_AI_API_KEY`(+위 OPENAI/ANTHROPIC) | 수동 관측 |
| 네이버 검색량·연관어·순위 | `NAVER_CLIENT_ID/SECRET`, `NAVER_AD_*`, `NAVER_SEARCH_*` | 데모 추정 |
| 구글 GSC·GA4 | `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REDIRECT_URI` | 수기 입력 |
| 직원 메일 매직링크 | `EMAIL_SERVER`, `EMAIL_FROM` | 관리자 비번/링크 전달 |
| 카카오 알림톡 | `KAKAO_ALIMTALK_API_KEY/SENDER/ENDPOINT` | 링크 복사 폴백 |
| 결제(토스) | `TOSS_SECRET_KEY`, `TOSS_CLIENT_KEY` | 데모 결제 |
| 발행(WP/Make) | `WORDPRESS_*`, `MAKE_WEBHOOK_URL` | 초안 저장/수동 발행 |
| 에셋 저장소(S3/R2) | `STUDIO_S3_*` | DB(StoredFile) 폴백 |

> ⚠️ 결제 키 이름은 `TOSS_SECRET_KEY`(과거 `TOSSPAYMENTS_SECRET_KEY` 아님).

---

## 부트스트랩 계정 교체 절차 (요약)

1. `ADMIN_EMAIL`·`ADMIN_PASSWORD` 설정 → 재배포 → 실제 관리자 이메일로 로그인 확인
2. 앱 내 계정 설정에서 비밀번호 변경(→ DB 해시 저장, env는 복구용으로 유지)
3. `DISABLE_BOOTSTRAP_ADMIN=true` 설정 → 재배포
4. `/integrations` 코어 4항목(DB·관리자 로그인·크론·백도어 차단) 모두 초록 확인

---

## 최종 점검 — `/integrations`

배포 후 이 화면 하나로 전 항목 연결 상태를 확인한다(읽기 전용).
코어 4항목이 모두 **연결됨**이면 운영 준비 완료. 나머지는 계약·필요 시 점진 활성화.

관련 코드: `src/server/integrations/status.ts` (상태 레지스트리, 단일 진실원)
