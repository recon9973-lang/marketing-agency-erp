# Vercel 배포 가이드 (ERP)

## 자동화된 것 (이미 설정됨)
- `postinstall`: `prisma generate` — Vercel 설치 단계에서 Prisma 클라이언트 자동 생성
- `build`: `prisma migrate deploy && next build` — **배포 시 DB에 테이블 자동 생성** 후 빌드
- `prisma/migrations/0_init/` — 초기 스키마(24개 테이블) 마이그레이션

→ **DB만 연결하면 테이블 생성부터 빌드까지 자동**으로 됩니다.

## 회원님이 설정할 것 — Environment Variables

Vercel 프로젝트 → Settings → Environment Variables 에 추가:

| 키 | 값 | 필수 | 비고 |
|----|-----|:--:|------|
| `DATABASE_URL` | Postgres 연결 문자열 | ✅ | Vercel Postgres 연결 시 자동 주입되거나, 직접 붙여넣기 |
| `AUTH_SECRET` | 랜덤 문자열 | ✅ | `openssl rand -base64 32` 로 생성 |
| `AUTH_URL` | 배포 주소 | ✅ | 예: `https://marketing-agency-erp-pi.vercel.app` |
| `CREDENTIAL_ENC_KEY` | 64자 hex | ✅ | `openssl rand -hex 32` (AES-256-GCM 자격증명 암호화) |
| `EMAIL_SERVER` | SMTP 접속 URL | 로그인용 | 예: `smtp://user:pass@smtp.host:587` |
| `EMAIL_FROM` | 발신 이메일 | 로그인용 | 예: `no-reply@venomad.com` |

> `AUTH_SECRET`·`CREDENTIAL_ENC_KEY`는 **반드시 새로 생성**해서 넣으세요(공유 금지).

## DB 연결 순서 (Vercel Postgres)
1. Vercel → **Storage** → 만든 Postgres DB 선택 → **Connect Project** → `marketing-agency-erp` 연결
2. 이때 env 변수 접두어(prefix)를 비우거나 `DATABASE`로 맞춰 **`DATABASE_URL`**이 생기게 함
   (자동 생성된 `POSTGRES_URL` 등이 있으면, 그 값을 복사해 `DATABASE_URL`로 하나 더 추가해도 됨)
3. 위 표의 나머지 키(AUTH_SECRET 등) 추가
4. Deployments → Redeploy

→ 재배포 시 `migrate deploy`가 24개 테이블을 생성하고, ERP가 정상 작동합니다.

## 초기 관리자 (선택)
`prisma/seed.ts`가 있으면 시드로 초기 데이터 투입 가능:
```
DATABASE_URL=... pnpm prisma:seed
```
