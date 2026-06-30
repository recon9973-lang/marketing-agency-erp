# V2 §1 공통 인프라

## 목적

V1에서 구현된 ERP의 조회 중심 구조를 실제 운영 가능한 입력/수정/승인 흐름으로 확장하기 전에, 모든 모듈이 공통으로 사용할 기반을 먼저 정비한다. 이 섹션은 업무, 거래처, 휴가, 정산, 지출, 보고서, 설정 모듈의 CRUD/server actions를 안정적으로 붙이기 위한 공통 인프라 작업이다.

## 범위

### 1. 디자인 시스템과 공통 UI 컴포넌트

목표:

- 화면마다 반복되는 폼, 버튼, 배지, 테이블, 필터, 빈 상태, 오류 상태를 공통화한다.
- 이후 거래처 생성, 업무 상태 변경, 휴가 승인, 청구/지출 입력 화면을 빠르게 붙일 수 있게 한다.

작업 항목:

- 공통 `Button` 컴포넌트 추가.
- 공통 `Input`, `Select`, `Textarea`, `DateInput`, `NumberInput` 컴포넌트 추가.
- 공통 `FormField` 컴포넌트 추가.
- 공통 `StatusBadge` 또는 도메인별 badge helper 추가.
- 공통 `EmptyState` 컴포넌트 추가.
- 공통 `PageHeader` 컴포넌트 추가.
- 공통 `FilterBar` 패턴 정리.
- 현재 각 페이지에 흩어진 버튼/입력/카드 스타일을 공통 컴포넌트로 정리.

완료 기준:

- 신규/수정/승인 화면에서 같은 UI 컴포넌트를 재사용할 수 있다.
- 기존 `/clients`, `/work`, `/leave`, `/finance`, `/reports`, `/settings` 화면의 시각 스타일이 깨지지 않는다.
- `pnpm test`, `pnpm build`가 통과한다.

### 2. 공통 server action/API 응답 규약

목표:

- 모든 저장/수정/승인 액션이 같은 성공/실패 응답 형식을 사용한다.
- UI에서 오류 메시지와 성공 메시지를 일관되게 처리한다.

작업 항목:

- `src/server/action-result.ts` 추가.
- `ActionResult<T>` 타입 정의.
- `ok(data)` helper 정의.
- `fail(code, message, fieldErrors?)` helper 정의.
- Zod validation 오류를 `fieldErrors`로 변환하는 helper 추가.
- server action에서 사용할 `requireCurrentUser()` helper 추가.

예상 응답 구조:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        fieldErrors?: Record<string, string[]>;
      };
    };
```

완료 기준:

- 공통 action result helper 단위 테스트가 있다.
- validation 실패, 권한 실패, 성공 케이스를 표현할 수 있다.
- 후속 CRUD 작업에서 같은 응답 규약을 재사용할 수 있다.

### 3. 권한 미들웨어/서버 권한 helper 정비

목표:

- 각 저장소와 server action에서 권한 체크가 누락되지 않도록 공통 helper를 강화한다.
- 관리자 scope 규칙을 한 곳에서 재사용한다.

작업 항목:

- `src/server/authorization.ts` 추가 또는 기존 `src/domain/access-control.ts` 확장.
- `requireRole(user, roles)` helper 추가.
- `requireClientAccess(user, clientId)` helper 추가.
- `requireMarketerAccess(user, marketerId)` helper 추가.
- 관리자 access scope 조회 helper 공통화.
- 고객사/담당자 scope 기반 Prisma where builder 공통화 검토.
- production에서 dev session이 절대 동작하지 않는 테스트 보강.

완료 기준:

- 최고관리자, 관리자, 담당자 권한 체크 단위 테스트가 있다.
- 관리자에게 지정된 담당자/거래처 범위만 허용된다.
- 담당자가 다른 담당자 거래처나 업무를 수정할 수 없다.

### 4. 공통 에러 처리와 로깅

목표:

- 운영 중 오류가 발생했을 때 사용자에게는 안전한 메시지를 보여주고, 서버에는 원인을 추적할 정보를 남긴다.

작업 항목:

- `src/server/errors.ts` 추가.
- `AppError` 또는 `DomainError` 타입 추가.
- 오류 코드 표준화.
- `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `INTERNAL_ERROR` 코드 정의.
- server action error wrapper 추가.
- audit log와 연결 가능한 summary 생성 helper 추가.

완료 기준:

- 사용자에게 raw DB/Prisma 오류가 직접 노출되지 않는다.
- 테스트에서 권한 오류와 validation 오류가 기대한 형식으로 반환된다.

### 5. 감사 로그 저장 기반

목표:

- V1에서 만든 `buildAuditEvent`를 실제 DB 저장 흐름으로 확장한다.
- 업무 상태 변경, 휴가 승인, 청구/입금 수정, 지출 검토, 보고서 승인 같은 민감 작업이 기록되게 한다.

작업 항목:

- `writeAuditLog(input)` 구현.
- actorId, action, targetType, targetId, beforeState, afterState 저장.
- audit action 상수 정의.
- 테스트용 mock repository 추가.
- 후속 CRUD 작업에서 audit log를 호출할 수 있게 인터페이스 정리.

완료 기준:

- audit log 저장 단위 테스트가 있다.
- 실패 시 사용자 작업을 막을지, 로그만 실패 처리할지 정책이 문서화된다.

### 6. 공통 validation schema

목표:

- 거래처, 업무, 휴가, 정산, 지출, 보고서 입력값 검증을 일관되게 처리한다.

작업 항목:

- `src/domain/validation.ts` 또는 도메인별 schema 파일 추가.
- 공통 문자열 trim helper.
- 금액 validation.
- 날짜 range validation.
- enum validation.
- pagination/filter validation.

완료 기준:

- 잘못된 입력이 server action 이전/내부에서 차단된다.
- field-level 오류 메시지를 UI에 표시할 수 있다.

### 7. 테스트 인프라 정비

목표:

- 후속 CRUD 구현에서 TDD를 빠르게 반복할 수 있도록 테스트 helper를 정리한다.

작업 항목:

- repository mock helper 정리.
- current user fixture 추가.
- role별 user fixture 추가.
- access scope fixture 추가.
- action result matcher/helper 추가.
- e2e dev session helper 정리.

완료 기준:

- 신규 server action 테스트 작성 시 반복 mock 코드가 줄어든다.
- `pnpm test`, `pnpm build`, `ALLOW_DEV_SESSION=true pnpm test:e2e`가 계속 통과한다.

## Sprint 1 권장 작업 순서

1. 공통 action result helper와 테스트 추가.
2. 공통 error type/helper 추가.
3. 권한 helper 공통화.
4. audit log 저장 helper 추가.
5. validation helper 추가.
6. 공통 UI 컴포넌트 추가.
7. e2e/dev session helper 정리.
8. 기존 화면이 깨지지 않는지 빌드/테스트 검증.

## Sprint 1 완료 기준

- V2 CRUD 작업을 시작할 수 있는 공통 기반이 준비된다.
- 모듈별 저장/수정/승인 작업에서 같은 응답 규약, 같은 권한 helper, 같은 validation 방식, 같은 오류 처리 방식을 쓴다.
- 기존 V1 기능은 회귀 없이 유지된다.
- 다음 검증이 통과한다.

```bash
pnpm test
pnpm build
ALLOW_DEV_SESSION=true pnpm test:e2e
```

## 명시적 제외 범위

이 섹션에서는 다음을 구현하지 않는다.

- 거래처 CRUD 전체.
- 업무 생성/수정 전체.
- 휴가 신청/승인 전체.
- 청구/입금/지출 입력 전체.
- 보고서 작성/승인 전체.
- PG 실연동.
- 계좌/카드 실거래 동기화.
- Google/Naver Calendar 실동기화.
- 블로그 방문자수 자동 수집.

위 기능들은 §1 공통 인프라 완료 후 각 도메인별 V2 섹션에서 구현한다.
