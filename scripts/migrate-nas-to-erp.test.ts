// scripts/migrate-nas-to-erp.test.ts
import { describe, it, expect } from "vitest";
import { WorkCategory, WorkStatus } from "@prisma/client";
// 암호화 경로 테스트용 — 결정적 32바이트 키(hex 64). 실제 배포 키와 무관.
process.env.CREDENTIAL_ENC_KEY = process.env.CREDENTIAL_ENC_KEY || "0123456789abcdef".repeat(4);
import { nasId, resolveUser, mapClient, mapAccount, mapChecklistItem, mapMemo, type MigrateOptions } from "./migrate-nas-to-erp";

const opts: MigrateOptions = {
  staffIdMap: { "1": "user-a", "2": "user-b" },
  fallbackUserId: "user-fallback",
  encryptCredentials: false
};

describe("NAS→ERP 이관 매핑(설계 §5)", () => {
  it("nasId는 결정적(재실행 시 같은 id → upsert 멱등)", () => {
    expect(nasId("client", 7)).toBe("nas-client-7");
    expect(nasId("client", "7")).toBe("nas-client-7");
  });

  it("resolveUser는 매핑되면 ERP User, 미매핑이면 fallback을 반환한다", () => {
    expect(resolveUser(1, opts)).toBe("user-a");
    expect(resolveUser("2", opts)).toBe("user-b");
    expect(resolveUser(999, opts)).toBe("user-fallback");
    expect(resolveUser(null, opts)).toBe("user-fallback");
  });

  it("mapClient: id·code 결정적, 스태프→assignedMarketerId, active 기본 true", () => {
    const m = mapClient({ id: 10, name: "시원마취통증의학과의원", staffId: 1, region: "창원" }, opts);
    expect(m.where.id).toBe("nas-client-10");
    expect(m.create.code).toBe("nas-client-10"); // code 없으면 결정적 id
    expect(m.create.assignedMarketerId).toBe("user-a");
    expect(m.create.region).toBe("창원");
    expect(m.create.active).toBe(true);
    // update는 code를 건드리지 않는다(수동 변경 보존)
    expect("code" in m.update).toBe(false);
  });

  it("mapClient: code가 있으면 사용, active=0이면 false", () => {
    const m = mapClient({ id: 11, name: "X", code: "SKIN", active: 0 }, opts);
    expect(m.create.code).toBe("SKIN");
    expect(m.create.active).toBe(false);
    expect(m.create.assignedMarketerId).toBeNull(); // staffId 없음
  });

  it("mapAccount: 평문 비번 미이관, 힌트는 credentialHint, 암호화 off면 enc는 null", () => {
    const m = mapAccount({ id: 5, clientId: 10, label: "네이버 플레이스", username: "clinic", passwordHint: "생일4자리", url: "https://x" }, opts);
    expect(m.where.id).toBe("nas-acct-5");
    expect(m.create.clientId).toBe("nas-client-10");
    expect(m.create.credentialHint).toBe("생일4자리");
    expect(m.create.passwordEnc).toBeNull();
    expect(m.create.usernameEnc).toBeNull();
    expect(m.create.externalUrl).toBe("https://x");
  });

  it("mapAccount: 암호화 on이면 passwordHint/username이 enc로 저장(평문 아님)", () => {
    const m = mapAccount({ id: 6, clientId: 10, passwordHint: "secret", username: "u" }, { ...opts, encryptCredentials: true });
    expect(m.create.passwordEnc).toMatch(/^v1:/);
    expect(m.create.usernameEnc).toMatch(/^v1:/);
    expect(m.create.credentialHint).toBe("secret"); // 힌트는 그대로(사람이 알아볼 단서)
  });

  it("mapChecklistItem: done→COMPLETED/completedAt, 아니면 NOT_STARTED", () => {
    const done = mapChecklistItem({ id: 3, clientId: 10, title: "GSC 권한", done: 1, staffId: 2 }, opts);
    expect(done.where.id).toBe("nas-chk-3");
    expect(done.create.ownerId).toBe("user-b");
    expect(done.create.status).toBe(WorkStatus.COMPLETED);
    expect(done.create.completedAt).toBeInstanceOf(Date);
    expect(done.create.category).toBe(WorkCategory.ACCOUNT_MANAGEMENT);

    const todo = mapChecklistItem({ id: 4, clientId: 10, title: "sitemap", done: 0 }, opts);
    expect(todo.create.status).toBe(WorkStatus.NOT_STARTED);
    expect(todo.create.completedAt).toBeNull();
    expect(todo.create.ownerId).toBe("user-fallback"); // staffId 없음
  });

  it("mapMemo: Comment(targetType=CLIENT, targetId=nas-client), 작성자 매핑", () => {
    const m = mapMemo({ id: 2, clientId: 10, body: "원장 미팅 메모", staffId: 1 }, opts);
    expect(m.where.id).toBe("nas-memo-2");
    expect(m.create.targetType).toBe("CLIENT");
    expect(m.create.targetId).toBe("nas-client-10");
    expect(m.create.authorId).toBe("user-a");
    expect(m.create.body).toBe("원장 미팅 메모");
  });

  it("upsert create/update가 where.id를 공유한다(멱등 계약)", () => {
    const m = mapClient({ id: 10, name: "A" }, opts);
    expect(m.create.id).toBe(m.where.id);
  });
});
