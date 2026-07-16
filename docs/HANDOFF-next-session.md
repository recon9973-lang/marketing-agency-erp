# VENOM ERP — 다음 세션 인수인계 프롬프트

> 이 파일을 다음 세션 시작 프롬프트로 붙여넣으면 바로 이어서 작업할 수 있습니다.
> 상세 작업 기록은 `docs/2026-07-16-erp-work-log.md` 참고.

---

## 프로젝트

- **무엇**: 한국 마케팅 대행사(㈜베놈) ERP. Next.js 15.5 App Router + Prisma 6 + Neon Postgres + pnpm.
- **저장소/브랜치**: `recon9973-lang/marketing-agency-erp` · 작업·배포 브랜치 **`erp-v1`** (Vercel 자동배포).
- **Vercel 프로젝트**: `marketing-agency-erp` · **도메인 `erp.seokorea.org`** (운영), `marketing-agency-erp-pi.vercel.app`.
- **DB**: Neon **싱가포르(ap-southeast-1)** · 런타임은 `DATABASE_URL_UNPOOLED`.
- **브랜드**: 오렌지 `#d9662e`, 회사 "㈜베놈".

## 반드시 지킬 규칙 (그대로 준수)

- 모든 작업은 **`erp-v1`** 브랜치에 커밋·푸시(`git push -u origin erp-v1`). 완료 시마다 푸시.
- 커밋 트레일러 끝에 항상:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01GRSbEN1cWpjeqtoKXgjjQm`
- **비밀값 절대 커밋/로그 금지** (관리자 비밀번호, API 키 등). env는 Vercel에만.
- 모델 ID(`claude-opus-4-8`)를 커밋/PR/코드/주석에 넣지 말 것 — 채팅 답변에만.
- GitHub 범위는 **`recon9973-lang/marketing-agency-erp`** 뿐.
- **`"use server"` 파일은 async 함수만 export** 가능(Next 15.5). `export type` 은 안전.
- 타입체크: `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v RouteImpl | grep -v typedRoutes` (route 관련은 빌드시 해소).
- **`[skip ci]` 자동봇 비활성화됨** — HEAD가 skip-ci 커밋이면 배포 안 됨(현재는 꺼둠). 배포 안 되면 이것부터 확인.

## 로컬 워크트리

- `/tmp/.../scratchpad/orange` (프로젝트 루트). Playwright 브라우저: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

---

## 현재 상태 (2026-07-16 기준, 전부 배포됨)

완료:
- 계약서 서명/도장, 설문 2종(시작/마감)+기타입력, 권한 ①②③④, 성능(리전 싱가포르), 배포 안정화, 로그인/인증 정상화.
- **이메일**: Resend 연동 + `seokorea.org` DKIM/SPF **인증 완료**. 매직링크 로그인 발송·수신 확인됨.
- **가입 흐름**: 초대 자동메일 + 셀프가입(로그인 화면)·관리자 승인(설정) 배포됨.
- **부트스트랩 로그인 계정**이 `src/server/auth.ts` 에 있음(env 무관 고정, 테스트/잠금방지용). 운영 전 제거/교체 필요.

## 다음에 할 일 (우선순위)

1. **[사용자] Vercel env 마무리** — `EMAIL_FROM=noreply@seokorea.org`, `AUTH_URL=https://erp.seokorea.org`, (선택)`CANONICAL_HOST=erp.seokorea.org` 설정 후 재배포. → 이메일 기능 완전체.
2. **초대·셀프가입 메일 E2E 수신 확인** (다른 이메일로도 도착하는지).
3. **운영 전환 시 부트스트랩 계정(`admin@venom.app`) 제거/비번 교체**.
4. **거래처 탭 로딩 제거 테스트**(`src/app/(erp)/clients/loading.tsx`, 커밋 34799bf) 유지/삭제 결정.
5. (기존 백로그) GEO 엔진 v1.8.0 디렉터 저장소 패치 / misojin.kr 실측 66점 대조 / 작업문서 Google Docs 업로드.

## 핵심 교훈(재발 방지)

- **배포가 반영 안 되면**: ① HEAD가 `[skip ci]`인지 ② 빌드가 Building에서 멈췄는지 ③ 보는 URL이 최신 배포인지(`/api/version` 류로 확인 — 지금은 제거됨, 필요시 재생성). 대부분 "옛 배포 서빙"이 원인.
- **성능**: 함수와 DB를 **같은 리전**에 둘 것(현재 둘 다 싱가포르). DB 위치부터 확인.
- **로그인 실패**: `authorizeAdmin`은 부트스트랩→env→DB해시 순 검증. env 값은 배포 이후 스냅샷이라 변경 후 **재배포** 필요.

## 참고 파일

- 작업 로그: `docs/2026-07-16-erp-work-log.md`
- 인증: `src/server/auth.ts`, `src/server/security/password.ts`, `src/server/session.ts`
- 권한: `src/domain/features.ts`, `src/server/feature-guard.ts`, `src/components/settings/*`
- 가입: `src/server/actions/signup.ts`, `src/components/auth/SignupRequestForm.tsx`, `src/components/settings/PendingApprovals.tsx`
- 설문: `src/server/actions/surveys.ts`, `src/components/survey/PublicSurveyForm.tsx`

---

### 다음 세션 시작 멘트(예시)
> "VENOM ERP(`erp-v1`) 이어서 진행. `docs/HANDOFF-next-session.md` 와 `docs/2026-07-16-erp-work-log.md` 먼저 읽고 현재 상태 파악해줘. 오늘은 [원하는 작업]부터."
