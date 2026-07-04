---
name: schedule
description: 구조화된 append-only 작업 대장(스케줄). 작업을 시작하기 전 계획을 등록하고, 끝난 뒤 결과를 기록하며, 이후 변경이 생길 때마다 업데이트 로그를 추가한다. 어떤 항목도 삭제하지 않고 모두 누적 보관한다. Use this whenever the user wants to log, track, register, or organize work items — before starting a task (register the plan), after finishing (record the result), or when an existing task changes (append an update). Trigger phrases: "스케줄", "작업 등록", "작업 내용 정리", "진행 상황 기록", "작업 대장", "log this work", "track this task".
---

# 스케줄 — 작업 대장 스킬

작업 내용을 **구조화**해 누적 기록한다. 원칙은 세 가지다.

1. **작업 전 등록** — 시작하기 전에 무엇을, 왜, 어떤 범위로 할지 등록한다.
2. **작업 후 결과** — 끝나면 결과를 남긴다.
3. **변경마다 업데이트** — 이후 상태가 바뀌거나 진행이 있으면 로그를 **추가**한다.

**절대 삭제하지 않는다.** 상태 전이(등록됨 → 진행중 → 완료 / 보류)와 로그 추가만 한다. 모든 작업은 안정적인 ID(`TASK-001`…)로 영구 보관된다.

## 저장 구조

- 원본(단일 진실): `.claude/schedule/tasks.json` — 스키마가 강제하는 구조화 데이터.
- 사람용 뷰: `.claude/schedule/SCHEDULE.md` — 변경할 때마다 **자동 재생성**(직접 편집하지 말 것).

각 작업 항목의 구조:

| 필드 | 뜻 |
| --- | --- |
| `id` | `TASK-001` 형식의 불변 식별자 |
| `title` | 한 줄 제목 |
| `status` | `등록됨` \| `진행중` \| `완료` \| `보류` |
| `tags` | 분류 태그(선택) |
| `plan` | 작업 전 등록한 계획/범위 |
| `result` | 작업 후 결과 |
| `log[]` | `{at, type, note}` 누적 로그(created/started/update/status/done) |

## 사용 절차 (이 스킬이 호출되면)

명령은 프로젝트 루트에서 실행한다:

```bash
node .claude/skills/schedule/schedule.mjs <command> ...
```

1. **작업 전 — 등록**
   ```bash
   node .claude/skills/schedule/schedule.mjs add "홈 배너 8월 교체" --plan "여름 프로모션 배너 3종 제작·교체" --tags 디자인,홈
   ```
   출력 첫 줄의 `TASK-00X` ID를 기억한다. 등록 후 사용자에게 등록된 항목을 보여준다.

2. **작업 시작(선택)**
   ```bash
   node .claude/skills/schedule/schedule.mjs start 5 --note "소재 초안 착수"
   ```

3. **진행 중 — 기록(반복)**
   ```bash
   node .claude/skills/schedule/schedule.mjs update 5 "1차 시안 완료, 검토 요청"
   ```

4. **작업 후 — 결과**
   ```bash
   node .claude/skills/schedule/schedule.mjs done 5 --result "배너 3종 교체 완료, 게시 확인"
   ```

5. **이후 변경 — 계속 누적**
   완료된 작업이라도 후속 변경이 생기면 `update` 또는 `status`로 로그를 **추가**한다. 이전 기록은 지우지 않는다.
   ```bash
   node .claude/skills/schedule/schedule.mjs status 5 진행중 --note "고객 요청으로 문구 재수정"
   ```

### 조회

```bash
node .claude/skills/schedule/schedule.mjs list                 # 전체
node .claude/skills/schedule/schedule.mjs list --status 진행중  # 상태별
node .claude/skills/schedule/schedule.mjs show 5               # 상세
```

## 진행 규칙

- 사용자가 새 작업을 시작하려 하면, 코드를 만지기 **전에** 먼저 `add`로 등록한다.
- 의미 있는 진척(단계 완료, 결정, 막힘)마다 `update`로 로그를 남긴다.
- 작업을 마치면 `done --result`로 결과를 남기고, 사용자에게 해당 항목(`show <id>`)을 보여준다.
- ID를 모르면 `list`로 먼저 확인한다. 절대 항목을 삭제하거나 tasks.json을 손으로 지우지 않는다.
- `--plan`, `--result`, `--note` 안에 큰따옴표가 들어가면 작은따옴표로 감싸거나 이스케이프한다.
