#!/usr/bin/env node
/**
 * 스케줄 — 구조화된 append-only 작업 대장.
 *
 * 작업 전 계획을 등록(add)하고, 진행 중 기록(update)하고, 끝나면 결과(done)를 남긴다.
 * 어떤 항목도 삭제하지 않는다. 상태 전이와 로그 추가만 가능하다.
 *
 * 데이터(원본):   .claude/schedule/tasks.json
 * 사람용 렌더:     .claude/schedule/SCHEDULE.md  (변경 시 자동 재생성)
 *
 * 사용:
 *   node schedule.mjs add "<제목>" [--plan "<계획>"] [--tags a,b]
 *   node schedule.mjs start <id> [--note "<메모>"]
 *   node schedule.mjs update <id> "<메모>"
 *   node schedule.mjs done <id> [--result "<결과>"]
 *   node schedule.mjs status <id> <등록됨|진행중|완료|보류> [--note "<메모>"]
 *   node schedule.mjs list [--status <상태>] [--tag <태그>]
 *   node schedule.mjs show <id>
 *   node schedule.mjs render
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "../../schedule");
const DATA_FILE = resolve(DATA_DIR, "tasks.json");
const RENDER_FILE = resolve(DATA_DIR, "SCHEDULE.md");

const STATUSES = ["등록됨", "진행중", "완료", "보류"];
const STATUS_ICON = { 등록됨: "○", 진행중: "◐", 완료: "●", 보류: "⏸" };

function now() {
  return new Date().toISOString();
}

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  } catch {
    return iso;
  }
}

function load() {
  if (!existsSync(DATA_FILE)) {
    return { version: 1, seq: 0, tasks: [] };
  }
  return JSON.parse(readFileSync(DATA_FILE, "utf8"));
}

function save(db) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, `${JSON.stringify(db, null, 2)}\n`);
  render(db);
}

function pad(n) {
  return String(n).padStart(3, "0");
}

function findTask(db, id) {
  const norm = /^\d+$/.test(id) ? `TASK-${pad(Number(id))}` : id.toUpperCase();
  const task = db.tasks.find((t) => t.id === norm);
  if (!task) {
    fail(`작업을 찾을 수 없습니다: ${id}. 'list'로 ID를 확인하세요.`);
  }
  return task;
}

function fail(msg) {
  console.error(`[스케줄] ${msg}`);
  process.exit(1);
}

/** 위치 인자와 --flag 를 분리. --flag 는 값 하나를 가진다. */
function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(token);
    }
  }
  return { positional, flags };
}

function render(db) {
  const tasks = [...db.tasks].sort((a, b) => a.id.localeCompare(b.id));
  const count = (s) => tasks.filter((t) => t.status === s).length;

  const lines = [];
  lines.push("# 작업 스케줄");
  lines.push("");
  lines.push("> 작업 전 계획을 등록하고, 끝나면 결과를 남기는 누적 대장입니다. 항목은 삭제하지 않습니다.");
  lines.push("");
  lines.push(
    `**전체 ${tasks.length}** · ${STATUS_ICON["진행중"]} 진행중 ${count("진행중")} · ` +
      `${STATUS_ICON["등록됨"]} 등록됨 ${count("등록됨")} · ${STATUS_ICON["완료"]} 완료 ${count("완료")} · ` +
      `${STATUS_ICON["보류"]} 보류 ${count("보류")}`
  );
  lines.push("");
  lines.push("## 진행 현황");
  lines.push("");
  lines.push("| ID | 상태 | 제목 | 등록 | 완료 |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const t of tasks) {
    const title = t.title.replace(/\|/g, "\\|");
    // '완료' 컬럼은 현재 상태가 완료일 때만 표시(재개되면 —). 이력은 로그에 남는다.
    const doneCell = t.status === "완료" ? fmt(t.doneAt) : "—";
    lines.push(
      `| ${t.id} | ${STATUS_ICON[t.status] ?? ""} ${t.status} | ${title} | ${fmt(t.createdAt)} | ${doneCell} |`
    );
  }
  if (tasks.length === 0) {
    lines.push("| — | — | 등록된 작업이 없습니다 | — | — |");
  }
  lines.push("");
  lines.push("## 상세");
  lines.push("");
  for (const t of tasks) {
    lines.push(`### ${t.id} · ${t.title}  \`${STATUS_ICON[t.status] ?? ""} ${t.status}\``);
    if (t.tags && t.tags.length) lines.push(`태그: ${t.tags.map((x) => `\`${x}\``).join(" ")}`);
    lines.push("");
    lines.push(`- 등록: ${fmt(t.createdAt)}`);
    if (t.startedAt) lines.push(`- 시작: ${fmt(t.startedAt)}`);
    if (t.status === "완료" && t.doneAt) lines.push(`- 완료: ${fmt(t.doneAt)}`);
    lines.push("");
    lines.push(`**계획**  \n${t.plan || "_미기재_"}`);
    lines.push("");
    lines.push(`**결과**  \n${t.result || "_진행 전/진행 중_"}`);
    lines.push("");
    lines.push("**업데이트 로그**");
    for (const entry of t.log) {
      lines.push(`- \`${fmt(entry.at)}\` [${entry.type}] ${entry.note}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(RENDER_FILE, `${lines.join("\n")}`);
}

function cmdAdd(positional, flags) {
  const title = positional[0];
  if (!title) fail('제목이 필요합니다. 예: add "홈 배너 교체" --plan "..."');
  const db = load();
  db.seq += 1;
  const id = `TASK-${pad(db.seq)}`;
  const ts = now();
  const tags = flags.tags && flags.tags !== true ? String(flags.tags).split(",").map((s) => s.trim()).filter(Boolean) : [];
  const task = {
    id,
    title,
    status: "등록됨",
    tags,
    plan: flags.plan && flags.plan !== true ? String(flags.plan) : "",
    result: "",
    createdAt: ts,
    updatedAt: ts,
    startedAt: null,
    doneAt: null,
    log: [{ at: ts, type: "created", note: "작업 등록" }]
  };
  db.tasks.push(task);
  save(db);
  console.log(id);
  printTask(task);
}

function appendLog(task, type, note) {
  task.log.push({ at: now(), type, note });
  task.updatedAt = now();
}

function cmdStart(positional, flags) {
  const db = load();
  const task = findTask(db, positional[0] ?? "");
  task.status = "진행중";
  if (!task.startedAt) task.startedAt = now();
  appendLog(task, "started", flags.note && flags.note !== true ? String(flags.note) : "작업 시작");
  save(db);
  printTask(task);
}

function cmdUpdate(positional) {
  const db = load();
  const task = findTask(db, positional[0] ?? "");
  const note = positional.slice(1).join(" ");
  if (!note) fail('메모가 필요합니다. 예: update 3 "API 응답 파싱 완료"');
  appendLog(task, "update", note);
  save(db);
  printTask(task);
}

function cmdDone(positional, flags) {
  const db = load();
  const task = findTask(db, positional[0] ?? "");
  task.status = "완료";
  task.doneAt = now();
  if (flags.result && flags.result !== true) task.result = String(flags.result);
  appendLog(task, "done", task.result ? `완료: ${task.result}` : "완료");
  save(db);
  printTask(task);
}

function cmdStatus(positional, flags) {
  const db = load();
  const task = findTask(db, positional[0] ?? "");
  const status = positional[1];
  if (!STATUSES.includes(status)) fail(`상태는 다음 중 하나여야 합니다: ${STATUSES.join(", ")}`);
  task.status = status;
  if (status === "진행중" && !task.startedAt) task.startedAt = now();
  if (status === "완료" && !task.doneAt) task.doneAt = now();
  appendLog(task, "status", `상태 → ${status}${flags.note && flags.note !== true ? ` (${flags.note})` : ""}`);
  save(db);
  printTask(task);
}

function cmdList(flags) {
  const db = load();
  let tasks = [...db.tasks].sort((a, b) => a.id.localeCompare(b.id));
  if (flags.status && flags.status !== true) tasks = tasks.filter((t) => t.status === flags.status);
  if (flags.tag && flags.tag !== true) tasks = tasks.filter((t) => (t.tags || []).includes(String(flags.tag)));
  if (tasks.length === 0) {
    console.log("(해당하는 작업이 없습니다)");
    return;
  }
  for (const t of tasks) {
    console.log(`${t.id}  ${STATUS_ICON[t.status] ?? ""} ${t.status.padEnd(4)}  ${t.title}`);
  }
}

function printTask(task) {
  console.log(`\n${task.id} · ${task.title}  [${STATUS_ICON[task.status] ?? ""} ${task.status}]`);
  if (task.tags && task.tags.length) console.log(`태그: ${task.tags.join(", ")}`);
  if (task.plan) console.log(`계획: ${task.plan}`);
  if (task.result) console.log(`결과: ${task.result}`);
  console.log("로그:");
  for (const entry of task.log) {
    console.log(`  ${fmt(entry.at)} [${entry.type}] ${entry.note}`);
  }
}

function cmdShow(positional) {
  const db = load();
  const task = findTask(db, positional[0] ?? "");
  printTask(task);
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  switch (cmd) {
    case "add":
      return cmdAdd(positional, flags);
    case "start":
      return cmdStart(positional, flags);
    case "update":
      return cmdUpdate(positional);
    case "done":
      return cmdDone(positional, flags);
    case "status":
      return cmdStatus(positional, flags);
    case "list":
      return cmdList(flags);
    case "show":
      return cmdShow(positional);
    case "render":
      return render(load());
    default:
      console.log(
        [
          "스케줄 — 구조화 작업 대장 (append-only, 삭제 없음)",
          "",
          '  add "<제목>" [--plan "<계획>"] [--tags a,b]   작업 전 등록',
          '  start <id> [--note "<메모>"]                   진행 시작',
          '  update <id> "<메모>"                           진행 기록(로그 추가)',
          '  done <id> [--result "<결과>"]                  작업 후 결과',
          "  status <id> <등록됨|진행중|완료|보류> [--note]  상태 변경",
          "  list [--status <상태>] [--tag <태그>]           목록",
          "  show <id>                                        상세",
          "  render                                           SCHEDULE.md 재생성"
        ].join("\n")
      );
  }
}

main();
