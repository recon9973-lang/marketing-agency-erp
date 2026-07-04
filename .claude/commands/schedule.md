---
description: 작업 대장(스케줄) — 작업 전 계획 등록, 진행 기록, 결과 남김. 누적·삭제 없음.
argument-hint: add "<제목>" --plan "..." | start <id> | update <id> "<메모>" | done <id> --result "..." | status <id> <상태> | list | show <id>
allowed-tools: Bash(node .claude/skills/schedule/schedule.mjs:*)
---

`schedule` 스킬(`.claude/skills/schedule/schedule.mjs`)로 구조화된 누적 작업 대장을 관리한다.
규칙은 `.claude/skills/schedule/SKILL.md`를 따른다: **작업 전 `add`로 계획 등록 → 진행 중 `update` → 끝나면 `done --result`**,
이후 변경은 `update`/`status`로 계속 누적한다. 어떤 항목도 삭제하지 않는다.

사용자 요청: $ARGUMENTS

처리 방법:
- 요청을 해석해 알맞은 하위 명령을 실행한다. 예:
  - 등록: `node .claude/skills/schedule/schedule.mjs add "<제목>" --plan "<계획>" [--tags a,b]`
  - 진행 기록: `node .claude/skills/schedule/schedule.mjs update <id> "<메모>"`
  - 결과: `node .claude/skills/schedule/schedule.mjs done <id> --result "<결과>"`
  - 상태 변경: `node .claude/skills/schedule/schedule.mjs status <id> <등록됨|진행중|완료|보류> [--note "<메모>"]`
  - 조회: `node .claude/skills/schedule/schedule.mjs list [--status <상태>]` / `show <id>`
- 인자가 비어 있으면 `list`로 현재 대장을 보여준다.
- 명령 실행 후 결과(해당 항목 또는 목록)를 사용자에게 보여준다.
