// 거래처 여정 타임라인 — 8단계 흐름을 시간순 마일스톤으로 집계(파이프라인 가시성, Phase 3).
// 상담(리드)→컨설팅→미팅→계약→배정→키워드→GEO→콘텐츠를 한곳에 모은다. 권한은 호출부에서 확인.
import { db } from "@/server/db";

export type JourneyEvent = {
  stage: number; // 1~8 (사장님 8단계)
  label: string; // 단계명
  title: string; // 이벤트 제목
  date: string | null; // ISO(없으면 정렬 뒤로)
  sub?: string; // 보조 설명
};

const ymd = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function getClientJourney(clientId: string): Promise<JourneyEvent[]> {
  const [lead, consultings, meetings, contracts, kwCount, kwFirst, geoFirst, geoCount, contents, client] = await Promise.all([
    db.lead.findFirst({ where: { clientId }, orderBy: { createdAt: "asc" }, select: { createdAt: true, auditScore: true, hospitalName: true } }),
    db.consultingReport.findMany({ where: { clientId }, orderBy: { createdAt: "asc" }, select: { createdAt: true, keywords: true } }),
    db.meeting.findMany({ where: { clientId }, orderBy: { createdAt: "asc" }, select: { createdAt: true, title: true, status: true } }),
    db.contract.findMany({ where: { clientId }, orderBy: { createdAt: "asc" }, select: { createdAt: true, signedAt: true, status: true, title: true } }),
    db.keyword.count({ where: { clientId } }),
    db.keyword.findFirst({ where: { clientId }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.geoAnswerRecord.findFirst({ where: { question: { clientId } }, orderBy: { checkedOn: "asc" }, select: { checkedOn: true } }),
    db.geoQuestion.count({ where: { clientId } }),
    db.contentPlan.findMany({ where: { clientId, status: "PUBLISHED" }, orderBy: { updatedAt: "asc" }, select: { topic: true, updatedAt: true } }),
    db.client.findUnique({ where: { id: clientId }, select: { createdAt: true, assignedMarketer: { select: { name: true } } } })
  ]);

  const events: JourneyEvent[] = [];

  // 1. 상담문의(리드)
  if (lead) {
    events.push({
      stage: 1,
      label: "상담문의",
      title: "영업 리드 접수",
      date: ymd(lead.createdAt),
      sub: lead.auditScore != null ? `무료 SEO 진단 ${lead.auditScore}점` : undefined
    });
  }

  // 2. 컨설팅 보고서
  for (const c of consultings) {
    const kwn = Array.isArray(c.keywords) ? (c.keywords as unknown[]).length : 0;
    events.push({ stage: 2, label: "자료·컨설팅", title: "컨설팅 보고서 생성", date: ymd(c.createdAt), sub: kwn ? `키워드 ${kwn}개 분석` : undefined });
  }

  // 3. 미팅
  for (const m of meetings) {
    events.push({ stage: 3, label: "보고·미팅", title: m.title || "미팅", date: ymd(m.createdAt), sub: m.status === "DONE" ? "완료" : "예정/진행" });
  }

  // 4. 계약
  for (const ct of contracts) {
    events.push({ stage: 4, label: "계약", title: ct.title || "계약서", date: ymd(ct.createdAt), sub: "작성" });
    if (ct.signedAt) events.push({ stage: 4, label: "계약", title: `${ct.title || "계약"} 서명 완료`, date: ymd(ct.signedAt), sub: "체결" });
  }

  // 5. 담당자 배정 (거래처 생성 시점)
  if (client) {
    events.push({
      stage: 5,
      label: "배정",
      title: "거래처 전환·담당자 배정",
      date: ymd(client.createdAt),
      sub: client.assignedMarketer?.name ? `담당 ${client.assignedMarketer.name}` : "미배정"
    });
  }

  // 6. 키워드 수집
  if (kwCount > 0) {
    events.push({ stage: 6, label: "키워드", title: `키워드 ${kwCount}개 등록`, date: ymd(kwFirst?.createdAt), sub: "월보장·타깃 확정" });
  }

  // 7. GEO 측정
  if (geoCount > 0) {
    events.push({
      stage: 7,
      label: "GEO",
      title: geoFirst ? "GEO 관측 시작" : `GEO 질문 ${geoCount}개 설계`,
      date: ymd(geoFirst?.checkedOn ?? null),
      sub: `측정질문 ${geoCount}개`
    });
  }

  // 8. 콘텐츠 발행 (최근 5건)
  for (const p of contents.slice(-5)) {
    events.push({ stage: 8, label: "콘텐츠", title: `발행: ${p.topic}`, date: ymd(p.updatedAt), sub: "게시 완료" });
  }

  // 시간순(오래된→최신). 날짜 없는 항목은 단계 순서로 뒤에.
  events.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.stage - b.stage;
  });

  return events;
}
