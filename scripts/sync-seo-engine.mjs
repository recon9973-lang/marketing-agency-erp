#!/usr/bin/env node
/**
 * VENOM SEO 엔진 동기화 — 총괄 디렉터(정본)의 엔진/규칙을 ERP 벤더 폴더로 내려받는다.
 *
 * 목적: ERP의 SEO 진단 툴이 "항상 이 파이프라인을 통해 최신화"되도록,
 *       배포(build)마다 디렉터 저장소의 최신 엔진으로 벤더 사본을 갱신한다.
 *
 * 사용:
 *   node scripts/sync-seo-engine.mjs           # 최신본으로 덮어쓰기
 *   node scripts/sync-seo-engine.mjs --check    # 갱신 필요 여부만 확인(비-0 종료코드로 표시)
 *
 * 실패 정책: 네트워크/인증 실패는 빌드를 막지 않는다(커밋된 사본 유지 + 경고 로그).
 *            정본 저장소가 비공개면 SEO_ENGINE_SYNC_TOKEN(read 토큰)으로 인증한다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const VENDOR = join(__dirname, "..", "src", "server", "seo-engine", "vendor");

const REPO = process.env.SEO_ENGINE_REPO || "recon9973-lang/desktop-tutorial";
const REF = process.env.SEO_ENGINE_REF || "main";
const BASE = `https://raw.githubusercontent.com/${REPO}/${REF}/venom-wordpress/preview/seo`;
const TOKEN = process.env.SEO_ENGINE_SYNC_TOKEN || "";

const FILES = [
  { remote: "seo-engine.js", local: "seo-engine.cjs" },
  { remote: "seo-rules.json", local: "seo-rules.json" }
];

const checkOnly = process.argv.includes("--check");

async function fetchText(url) {
  const headers = { "User-Agent": "venom-erp-seo-sync" };
  if (TOKEN) headers.Authorization = `token ${TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

function readLocal(name) {
  try {
    return readFileSync(join(VENDOR, name), "utf8");
  } catch {
    return null;
  }
}

async function main() {
  let changed = 0;
  let failed = 0;
  for (const f of FILES) {
    let remote;
    try {
      remote = await fetchText(`${BASE}/${f.remote}`);
    } catch (err) {
      failed++;
      console.warn(`[sync-seo-engine] ${f.remote} 내려받기 실패 (${err.message}) — 커밋된 사본 유지`);
      continue;
    }
    const local = readLocal(f.local);
    if (local === remote) {
      console.log(`[sync-seo-engine] ${f.local} 이미 최신`);
      continue;
    }
    changed++;
    if (checkOnly) {
      console.log(`[sync-seo-engine] ${f.local} 갱신 필요 (정본과 다름)`);
    } else {
      writeFileSync(join(VENDOR, f.local), remote);
      console.log(`[sync-seo-engine] ${f.local} 갱신 완료 ← ${REPO}@${REF}`);
    }
  }
  if (checkOnly && changed > 0) process.exit(1);
  if (failed === FILES.length) {
    console.warn("[sync-seo-engine] 전부 실패 — 오프라인/비공개 저장소일 수 있음. 벤더 사본으로 진행.");
  }
  // 활성 엔진 버전·정본 출처를 배포 로그에 남긴다(항상 같은 엔진 사용 확인용).
  try {
    const eng = require(join(VENDOR, "seo-engine.cjs"));
    console.log(`[sync-seo-engine] 활성 엔진: VENOM SEO v${eng.version} · 정본 ${REPO}@${REF}`);
  } catch {
    /* 벤더 사본 로드 불가 — 무시 */
  }
}

main().catch((err) => {
  console.warn(`[sync-seo-engine] 예기치 못한 오류 (${err.message}) — 벤더 사본으로 진행`);
});
