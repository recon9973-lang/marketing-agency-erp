# V2 §1 공통 인프라 — 구현 노트

V2 §1 공통 인프라(`docs/v2-section1-common-infra.md`, erp-v1 브랜치)에서 정의한
공통 기반을 구현한 결과를 정리한다. 이 섹션은 후속 도메인별 CRUD/server action이
같은 응답 규약, 같은 권한 helper, 같은 validation/오류 처리 방식을 쓰도록 만든다.

## 추가/변경된 모듈

### 1. 공통 server action 응답 규약 — `src/server/action-result.ts`

- `ActionResult<T>` : 성공 `{ ok: true, data }` / 실패 `{ ok: false, error }` 합 타입.
- `ok(data)`, `fail(code, message, fieldErrors?)` helper.
- `fieldErrorsFromZod(error)` : Zod 오류를 `Record<string, string[]>` field 오류로 변환.
- `toActionFailure(error)` / `runAction(fn)` : 던져진 오류(AppError/ZodError/그 외)를
  표준 실패 응답으로 변환하는 wrapper.

### 2. 공통 에러 처리/로깅 — `src/server/errors.ts`

- 표준 코드 `ErrorCode`: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
  `VALIDATION_ERROR`, `CONFLICT`, `INTERNAL_ERROR`.
- `AppError` 클래스 + 팩토리(`forbidden`, `notFound`, `validationError`, `conflict`,
  `unauthenticated`, `internalError`).
- `toSafeMessage(error)` : 사용자에게 노출 가능한 메시지(raw DB/Prisma 오류 비노출).
- `summarizeError(error)` : 감사 로그/서버 로그용 한 줄 요약.
- `logServerError(error, context?)` : 사용자 흐름을 막지 않는 서버 로깅.

### 3. 서버 권한 helper — `src/server/authorization.ts`, `src/server/scope.ts`

- `requireCurrentUser()` : 현재 직원 사용자 확인(없으면 `UNAUTHENTICATED`).
- `requireRole(user, roles)` : 역할 확인(불일치 시 `FORBIDDEN`).
- `requireClientAccess(user, clientId, { assignedMarketerId?, scopes? })`.
- `requireMarketerAccess(user, marketerId, scopes?)`.
- `loadAccessScopes(user)` / `buildAccessibleClientWhere(user, scopes)` : 관리자 scope
  조회와 거래처 Prisma where 빌더를 공통화. `clients` 저장소가 이를 재사용한다.
- 순수 판정은 `src/domain/access-control.ts`(boolean 함수 + assert)로 유지.

### 4. 감사 로그 저장 — `src/server/audit.ts`

- `writeAuditLog(input, repository?)` : actorId/action/targetType/targetId/
  beforeState/afterState 저장. 저장소를 주입할 수 있어 테스트에서 mock 사용.
- `AuditAction` 상수(업무 상태 변경, 휴가 승인/반려, 청구/입금/지출/보고서 등).
- 기존 `buildAuditEvent`(요약 문자열 생성)는 그대로 유지.

#### 감사 로그 실패 정책

감사 로그 기록은 **best-effort**이며 사용자 작업을 막지 않는다.

- 저장 실패 시 `logServerError`로 서버에 남기고 `writeAuditLog`은 `false`를 반환한다.
- 예외를 호출자에게 전파하지 않으므로, 주 작업(예: 휴가 승인)은 감사 로그 실패와
  무관하게 성공 처리된다.
- 즉 "감사 로그 실패로 사용자 작업을 막지 않는다"가 기본 정책이다. 추후 규제/보안상
  반드시 기록이 필요한 작업이 생기면, 해당 작업에 한해 `writeAuditLog` 반환값을 확인해
  실패 시 트랜잭션을 롤백하는 별도 정책을 도입한다.

### 5. 공통 validation schema — `src/domain/validation.ts`

- `requiredString` / `optionalString`(trim), `amountSchema`(0 이상 정수 금액),
  `isoDateSchema` / `dateRangeSchema`(start ≤ end), `enumSchema`(Prisma native enum),
  `paginationSchema`(page/pageSize 기본값·상한).

### 6. 공통 UI 컴포넌트 — `src/components/ui/*`

- 폼 컨트롤: `Button`, `Input`, `NumberInput`, `DateInput`, `Textarea`, `Select`.
- 레이아웃/상태: `FormField`, `StatusBadge`/`StatusDisplayBadge`, `EmptyState`,
  `PageHeader`, `FilterBar`/`FilterField`.
- 도메인 상태 → 배지 tone 매핑: `src/domain/status.ts`.
- 기존 화면 정리: `PlaceholderPage`, `/clients` 헤더를 `PageHeader`로 재사용.
- 배럴: `src/components/ui/index.ts`.

### 7. 테스트 인프라 — `tests/helpers/*`, `tests/e2e/helpers.ts`

- `users.ts`(역할별 현재 사용자 fixture), `scopes.ts`(access scope fixture),
  `audit.ts`(감사 로그 mock/실패 mock), `db.ts`(Prisma 모델 mock),
  `action-result.ts`(`expectOk`/`expectFail` matcher), e2e `gotoAs(page, role)`.

## 검증

```bash
pnpm test     # 단위 테스트
pnpm build    # 타입 체크 + 빌드
ALLOW_DEV_SESSION=true pnpm test:e2e
```

- `pnpm test`: 21개 파일, 91개 테스트 통과(§1로 49개 추가).
- `pnpm build`: 통과.
- e2e: `playwright.config.ts`가 `channel: "chrome"`를 사용하므로 Chrome이 설치된
  환경에서 실행한다. 본 작업에서는 동작 검증을 위해 기존 2개 스펙이 통과함을 확인했다.

## 명시적 제외(다음 도메인별 섹션에서 구현)

거래처/업무/휴가/청구·입금·지출/보고서 CRUD 전체, PG 실연동, 계좌·카드 동기화,
Google/Naver Calendar 실동기화, 블로그 방문자수 자동 수집은 이 섹션 범위가 아니다.
