# 감사 로그 저장 실패 정책

V2 §1 공통 인프라의 `writeAuditLog` 동작 정책을 기록한다.

## 결정

감사 로그 저장 실패는 **사용자 작업을 막지 않는다** (log-only failure).

- `writeAuditLog(input, repository?)`는 절대 throw 하지 않는다.
- 저장 성공 시 `{ ok: true }`, 실패 시 `{ ok: false, error }`를 반환한다.
- 실패 시 `console.error`로 원인과 `buildAuditSummary(input)` 요약을 서버 로그에 남긴다.
- 호출하는 server action은 반환값을 확인할 수 있지만, 실패를 이유로 본 작업을 롤백하지 않는다.

## 근거

- 감사 로그는 운영 추적용 보조 기록이다. 로그 테이블 장애가 휴가 승인이나 정산 입력 같은
  본 업무를 중단시키면 운영 피해가 더 크다.
- 대신 실패가 조용히 사라지지 않도록 서버 로그에 반드시 남기고, 반환값으로 호출부에서
  모니터링/알림에 연결할 수 있게 한다.

## 사용 규약

- 민감 작업(업무 상태 변경, 휴가 승인/반려, 청구/입금 수정, 지출 검토, 보고서 승인,
  권한 scope 변경)은 본 작업 커밋 후 `writeAuditLog`를 호출한다.
- action 값은 `AuditActions` 상수를 사용한다.
- 테스트에서는 `AuditLogRepository` 인터페이스를 구현한 mock repository를 주입한다.
