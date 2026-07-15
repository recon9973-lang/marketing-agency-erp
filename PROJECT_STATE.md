# PROJECT_STATE — marketing-agency-erp

> 🤖 자동 생성 파일. 직접 수정 금지 — `node scripts/gen-project-state.mjs`(또는 CI)가 push마다 갱신.
> **새 세션은 이 파일부터 읽어 재탐색 토큰을 아낀다.**

- **저장소**: marketing-agency-erp  ·  **현재 브랜치**: claude/project-audit-progress-z4bn01  ·  **기본 브랜치**: claude/project-audit-progress-z4bn01
- **이어갈 작업(RESUME)**: 없음

## 최근 커밋 (8)
- 2026-07-14 feat(studio): 전체 페이지 ZIP·PDF 대량 내보내기 (순번 파일명)
- 2026-07-13 feat(docs): 회사 도장 서식 자동 날인 — 대표 서명란에 인영 오버레이
- 2026-07-13 feat(docs): 회사 공식 서식 반영 — 임직원용 비밀유지 서약서 추가 + 멱등 백필
- 2026-07-13 refactor(nav): 업무 흐름 기반 메뉴 재편 + 유사 카테고리 정리
- 2026-07-13 feat(search): 빈 검색 상태에 즐겨찾기·최근 방문 노출
- 2026-07-13 feat(pwa): iOS 홈화면 아이콘(apple-touch-icon) 명시
- 2026-07-14 feat(studio): 템플릿 라이브러리(B1) + 카드뉴스 자동 분할(C1) (#39)
- 2026-07-14 feat(studio): 디자인 스튜디오 MVP + 에셋 스토리지(S3/DB) (#38)

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
`dev` · `build` · `seo:sync` · `postinstall` · `start` · `lint` · `test` · `test:watch` · `test:e2e` · `prisma:generate` · `prisma:migrate` · `prisma:seed`  ·  deps 15개

## 환경변수 표면 (이름만, 값 아님 · 626)
`ADMIN_EMAIL` · `ADMIN_PASSWORD` · `ADMIN_SECRET` · `ALLOW_DEV_SESSION` · `ANTHROPIC_API_KEY` · `APPDATA` · `ARM_VERSION` · `AUTH_DEMO_LOGIN` · `AUTH_FIGMA_ID` · `AUTH_FIGMA_SECRET` · `AUTH_FUSIONAUTH_CLIENT_ID` · `AUTH_FUSIONAUTH_CLIENT_SECRET` · `AUTH_FUSIONAUTH_ISSUER` · `AUTH_FUSIONAUTH_TENANT_ID` · `AUTH_LOOPS_KEY` · `AUTH_LOOPS_TRANSACTIONAL_ID` · `AUTH_MICROSOFT_ENTRA_ID_ID` · `AUTH_MICROSOFT_ENTRA_ID_ISSUER` · `AUTH_MICROSOFT_ENTRA_ID_SECRET` · `AUTH_SECRET` · `AUTH_TIKTOK_ID` · `AUTH_URL` · `AUTH_VIPPS_ID` · `AUTH_VIPPS_SECRET` · `AUTOPREFIXER_GRID` · `AWS_CONFIG_FILE` · `AWS_EC2_METADATA_SERVICE_ENDPOINT` · `AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE` · `AWS_LAMBDA_BENCHMARK_MODE` · `AWS_LAMBDA_FUNCTION_VERSION` · `AWS_LAMBDA_JS_RUNTIME` · `AWS_LOGIN_CACHE_DIRECTORY` · `AWS_PROFILE` · `AWS_REGION` · `AWS_SDK_JS_NODE_VERSION_SUPPORT_WARNING_DISABLED` · `AWS_SHARED_CREDENTIALS_FILE` · `AZURE_DEVOPS_APP_ID` · `AZURE_DEVOPS_CLIENT_SECRET` · `AZURE_DEVOPS_SCOPE` · `BABEL_ENV` · `…(+586)`

---
*생성: 커밋 7cbb5f7 기준. 값·비밀은 포함하지 않음.*
