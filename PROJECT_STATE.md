# PROJECT_STATE — marketing-agency-erp

> 🤖 자동 생성 파일. 직접 수정 금지 — `node scripts/gen-project-state.mjs`(또는 CI)가 push마다 갱신.
> **새 세션은 이 파일부터 읽어 재탐색 토큰을 아낀다.**

- **저장소**: marketing-agency-erp  ·  **현재 브랜치**: erp-v1  ·  **기본 브랜치**: erp-v1
- **이어갈 작업(RESUME)**: 없음

## 최근 커밋 (8)
- 2026-07-15 perf(loading): 전환 로딩을 페이지형 스켈레톤으로 교체
- 2026-07-15 chore: PROJECT_STATE 자동 갱신 [skip ci]
- 2026-07-15 perf(dashboard): 껍데기 먼저·데이터 스트리밍(Suspense)
- 2026-07-15 chore: PROJECT_STATE 자동 갱신 [skip ci]
- 2026-07-15 perf(router): 클라이언트 라우터 캐시 연장(dynamic 30→120s)
- 2026-07-15 chore: PROJECT_STATE 자동 갱신 [skip ci]
- 2026-07-16 feat(system): 세션 연속성·토큰 절약 시스템(최강스킬) 설치 (#41)
- 2026-07-15 feat(middleware): CANONICAL_HOST 정규 주소 통합 리다이렉트

## 워크플로 (1)
- `project-state.yml` · 수동

## Vercel crons
- `/api/marketing/cron` · 0 0 * * *

## API 엔드포인트 (16)
- `docs/erp-v2-staging/app-routes/report-pdf-route.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/generate-image/route.ts`
- `src/app/api/generate-post/route.ts`
- `src/app/api/integrations/google/callback/route.ts`
- `src/app/api/integrations/google/start/route.ts`
- `src/app/api/keywords/route.ts`
- `src/app/api/marketing/cron/route.ts`
- `src/app/api/meetings/transcribe/route.ts`
- `src/app/api/ping/route.ts`
- `src/app/api/reports/[id]/pdf/route.ts`
- `src/app/api/studio/assets/[id]/route.ts`
- `src/app/api/studio/uploads/route.ts`
- `src/app/api/vault/[id]/route.ts`
- `src/app/api/wp-draft/route.ts`
- `src/app/dev/session/route.ts`

## package 스크립트
`dev` · `build` · `seo:sync` · `postinstall` · `start` · `lint` · `test` · `test:watch` · `test:e2e` · `prisma:generate` · `prisma:migrate` · `prisma:seed`  ·  deps 17개

## 환경변수 표면 (이름만, 값 아님 · 66)
`ADMIN_EMAIL` · `ADMIN_PASSWORD` · `ADMIN_SECRET` · `ALLOW_DEV_SESSION` · `ANTHROPIC_API_KEY` · `AUTH_DEMO_LOGIN` · `AUTH_SECRET` · `AUTH_URL` · `CANONICAL_HOST` · `CANVA_ACCESS_TOKEN` · `CREDENTIAL_ENC_KEY` · `CRON_SECRET` · `DATABASE_URL` · `DATABASE_URL_UNPOOLED` · `DEV_SESSION_ROLE` · `EMAIL_FROM` · `EMAIL_SERVER` · `GEMINI_MODEL` · `GEO_ANTHROPIC_MODEL` · `GOOGLE_AI_API_KEY` · `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` · `GOOGLE_REDIRECT_URI` · `HIGGSFIELD_API_KEY` · `HIGGSFIELD_API_URL` · `KAKAO_ALIMTALK_API_KEY` · `KAKAO_ALIMTALK_ENDPOINT` · `KAKAO_ALIMTALK_SENDER` · `KAKAO_ALIMTALK_TEMPLATE` · `KW_PROXY_URL` · `MAGAZINE_DAILY_DRAFTS` · `MAKE_WEBHOOK_URL` · `MARKETING_CRON_SECRET` · `NAVER_AD_API_KEY` · `NAVER_AD_CUSTOMER_ID` · `NAVER_AD_SECRET` · `NAVER_CLIENT_ID` · `NAVER_CLIENT_SECRET` · `NAVER_SEARCH_CLIENT_ID` · `NAVER_SEARCH_CLIENT_SECRET` · `…(+26)`

---
*생성: 커밋 37aaaea 기준. 값·비밀은 포함하지 않음.*
