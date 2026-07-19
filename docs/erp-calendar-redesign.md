# 캘린더 재설계 — 자체 캘린더 중심(담당자별 + 관리자 전체뷰)

> 결정: 외부(구글/네이버) 캘린더 연동을 본체로 삼지 않고, **자체 캘린더가 본체**.
> 담당자별 일정을 관리하고 관리자가 팀 전체 일정을 본다. 외부 캘린더는 **선택적 내보내기**로 강등.
> 근거: `CalendarEvent.provider` 기본값이 이미 `INTERNAL` — 애초에 자체 캘린더가 본체 설계.

## 1. 왜 이 방향인가

| | 구글/네이버 연동 | 자체 캘린더 확장(채택) |
|---|---|---|
| 공수 | OAuth+직원별 토큰+동기화+충돌 (큼) | 기존 모델 확장 (작음) |
| 스키마 | 직원별 토큰 저장 필요 | (전체뷰는) 무변경 |
| 의존성 | 외부 API·쿼터·장애 | 없음 |
| 데이터 | 새로 끌어옴 | 업무·연차·보고서 이미 연결 |

`CalendarEvent`가 이미 `workItemId·leaveRequestId·reportId·clientId`에 연결 → 담당자별 일정 재료가 이미 존재.

## 2. 소유자(담당자) 파생 — 스키마 무변경

이벤트 소유자 = `workItem.owner` → `leaveRequest.requester` → `createdBy` 순 파생(`fetchTeamCalendarEvents`).
독립 이벤트(업무·연차 미연결)의 직접 담당자 지정이 필요해지면 `CalendarEvent.assigneeId`(nullable) 추가 —
**그때만 소규모 schema, 조율 후**.

## 3. 구현 단계

| 단계 | 내용 | 상태 |
|---|---|---|
| **C1** | 관리자 전체뷰 — 담당자별 그룹 카드(`/calendar`), 소유자 파생 | ✅ 구현(무스키마) |
| **C2** | 외부 캘린더 카드 → "선택·내보내기 준비중"으로 강등 | ✅ |
| C3 | 담당자별 필터·주간/월간 뷰·색상 | ✅ |
| C4 | `assigneeId` 직접 지정 + **일정 추가 폼**(독립 이벤트 생성·배정·삭제 액션) | ✅ (additive schema) |
| C5 | (선택) 구글 캘린더 **내보내기**(기존 OAuth 재사용) | ⏳ opt-in |

### C4 구현 메모
- `CalendarEvent.assigneeId`(nullable) + `@@index` 추가 — **additive**, `prisma db push`로 배포 시 자동 적용.
- 소유자 파생 순서: **assignee** → workItem.owner → leaveRequest.requester → createdBy → "미배정".
- 스코프: MARKETER는 본인 일정만(assigneeId=self), 관리자는 AccessScope 내 담당자 지정(`canAccessMarketer`).
- 액션: `createCalendarEvent`(KST→UTC, 권한검증), `deleteCalendarEvent`(시스템 이벤트=업무·연차·리포트 연결은 삭제 불가).
- UI: `/calendar` 상단 접이식 "일정 추가" 폼. 관리자만 담당자 드롭다운 노출.

## 4. 권한

- SUPER_ADMIN: 전체 팀 일정. ADMIN: AccessScope 범위. MARKETER: 본인 일정만(전체뷰 미노출).
- 기존 `buildCalendarWhere` 스코프 재사용 → 권한 일관.

## 5. 검증 한계(개발 샌드박스)

DB(Neon)가 샌드박스 프록시로 도달 불가 → DB 의존 화면 라이브 스크린샷 불가.
정합성은 **tsc의 Prisma select 타입체크 + 스키마 관계 확인**으로 검증. 배포 환경에서 실동작.
