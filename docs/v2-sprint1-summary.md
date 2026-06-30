# V2 1차 스프린트 요약

베놈 ERP V2 1차 스프린트 결과 요약. §1 공통 인프라를 먼저 구축한 뒤, 그 위에서
도메인별 입력/수정/승인(CRUD) 흐름을 차례로 구현했다. 모든 작업은 동일한 응답 규약
(`ActionResult`/`runAction`), 권한 helper(`require*`), validation(Zod), 오류 처리
(`AppError`), 감사 로그(`writeAuditLog`)를 공유한다.

## 완료 범위

| 섹션 | 내용 | 핵심 산출물 |
| --- | --- | --- |
| §1 | 공통 인프라 | action-result, errors, authorization/scope, audit, validation, UI 키트, 테스트 인프라 |
| §2 | 거래처 CRUD | `domain/clients`, `actions/clients`, ClientForm, `/clients/new`·`/clients/[id]/edit` |
| §3 | 업무 CRUD + 상태 전이 | `actions/work`, WorkForm/WorkStatusActions, `/work/new`·`/work/[id]/edit` |
| §4 | 휴가 신청/승인 | `actions/leave`, LeaveRequestForm/LeaveDecisionButtons |
| §5 | 청구/입금/지출 입력·검토 | `actions/finance`, Billing/Payment/Expense 폼 + 지출 검토 |
| §6 | 보고서 작성/승인 | `actions/report`, ReportForm/ReportStatusActions, `/reports/*` |

## 권한 요약

- 거래처: 생성=최고관리자, 수정=최고관리자/접근 권한 관리자, 담당자=읽기전용.
- 업무: 거래처+소유자 접근 권한 필요. 상태 전이는 도메인 전이표 기반.
- 휴가: 본인 신청, 승인/반려=최고관리자 또는 신청자 scope 관리자, 취소=본인/관리자.
- 청구·입금: 최고관리자/접근 권한 관리자. 지출 등록=직원 전체, 검토=관리자.
- 보고서: 작성=거래처 접근 직원, 승인/전달/반려=관리자/최고관리자.

## 감사 로그

민감 작업은 `writeAuditLog`(best-effort, 주 작업을 막지 않음)로 기록한다:
업무 상태 변경, 휴가 승인/반려/취소, 청구/입금 수정, 지출 검토, 보고서 제출/승인/전달/반려,
거래처 생성/수정.

## 검증

```bash
pnpm test   # 31 파일, 160 테스트 통과
pnpm build  # 통과
```

도메인별 입력/승인 흐름은 로컬 PostgreSQL + 브라우저로 end-to-end 검증했다
(거래처 생성/중복충돌, 업무 상태 전이+타임스탬프, 휴가 신청→승인, 청구→입금 상태 재계산,
지출 검토, 보고서 작성→제출→승인→전달). 각 흐름의 DB 상태와 감사 로그 적재를 확인했다.

> e2e 주의: 커밋된 `playwright.config.ts`는 `channel: "chrome"`를 사용하므로 Chrome이
> 설치된 환경에서 `ALLOW_DEV_SESSION=true pnpm test:e2e`를 실행한다.

## 이번 스프린트 제외(다음 단계)

§1 문서의 명시적 제외 범위에 따른 외부 연동은 본 스프린트에서 구현하지 않았다.
구현하려면 각 제공자 자격 증명/계약과 라이브 API 접근이 필요하다.

- PG 실연동(토스/이니시스/카카오페이).
- 계좌/카드 실거래 동기화.
- Google/Naver Calendar 실동기화.
- 블로그 방문자수 자동 수집(크롤러/API).

데이터 모델에는 위 연동을 위한 필드(예: `BillingRecord.pgProvider`,
`FinancialAccount`, 캘린더 연동 플래그)가 이미 준비되어 있어, 자격 증명이 확보되면
도메인별 연동 작업으로 이어갈 수 있다.
