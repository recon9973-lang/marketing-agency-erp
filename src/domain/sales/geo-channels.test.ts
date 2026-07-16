// src/domain/sales/geo-channels.test.ts
import { describe, it, expect } from "vitest";
import {
  clampLevel,
  channelCap,
  resolveAiChannelTasks,
  riskyAutomationViolations,
  AI_CHANNEL_TASKS
} from "./geo-channels";

describe("GEO 채널 cap-clamp — 고위험 채널 자동 실행 차단", () => {
  it("clampLevel: cap 초과(더 자동)면 cap 으로 강등, 더 낮은 자동화는 유지", () => {
    expect(clampLevel("A", "C")).toBe("C"); // 위키/커뮤니티(cap C)에서 A → C
    expect(clampLevel("B", "C")).toBe("C");
    expect(clampLevel("C", "C")).toBe("C");
    expect(clampLevel("D", "C")).toBe("D"); // 더 낮은 자동화는 유지
    expect(clampLevel("A", "A")).toBe("A");
    expect(clampLevel("C", "A")).toBe("C");
  });

  it("channelCap: 플레이북 채널의 자동화 상한 조회", () => {
    expect(channelCap("커뮤니티 Q&A (지식iN·카페·Reddit)")).toBe("C");
    expect(channelCap("FAQ/Article Schema + BLUF 구조")).toBe("A");
    expect(channelCap("없는채널")).toBeNull();
    expect(channelCap(undefined)).toBeNull();
  });

  it("resolveAiChannelTasks: 커뮤니티 업무는 C 로 유지(자동 실행 불가)", () => {
    const resolved = resolveAiChannelTasks();
    const community = resolved.find((t) => t.channel === "커뮤니티 Q&A (지식iN·카페·Reddit)");
    expect(community?.automationLevel).toBe("C");
    expect(community?.capped).toBe(false); // 이미 C 라 강등 없음
  });

  it("resolveAiChannelTasks: 실수로 고위험 채널을 B 로 설정해도 cap 으로 강등", () => {
    const tampered = [
      {
        title: "[자동화 B] 커뮤니티 자동 게시(오설정)",
        category: AI_CHANNEL_TASKS[0].category,
        offsetDays: 0,
        offsetFrom: "START" as const,
        automationLevel: "B" as const,
        channel: "커뮤니티 Q&A (지식iN·카페·Reddit)"
      }
    ];
    const [r] = resolveAiChannelTasks(tampered);
    expect(r.automationLevel).toBe("C"); // B → C 강등
    expect(r.capped).toBe(true);
  });

  it("불변식: 현재 AI_CHANNEL_TASKS 는 채널 cap 위반 0건", () => {
    expect(riskyAutomationViolations()).toEqual([]);
  });

  it("불변식 점검이 위반을 실제로 잡는다", () => {
    const bad = [
      {
        title: "위키 자동 게시(금지)",
        category: AI_CHANNEL_TASKS[0].category,
        offsetDays: 0,
        offsetFrom: "START" as const,
        automationLevel: "A" as const,
        channel: "커뮤니티 Q&A (지식iN·카페·Reddit)"
      }
    ];
    const v = riskyAutomationViolations(bad);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ declared: "A", cap: "C" });
  });
});
