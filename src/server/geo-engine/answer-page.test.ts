// src/server/geo-engine/answer-page.test.ts
import { describe, it, expect } from "vitest";
import { buildFaqJsonLd, buildAnswerPageMarkdown } from "./answer-page";

const draft = {
  title: "한의원 도수치료, 무엇을 확인해야 할까요?",
  summary: "도수치료는 근골격계 통증 완화에 활용되는 비수술 치료입니다. 치료 계획은 개인 상태에 따라 다릅니다.",
  sections: [
    { heading: "도수치료란", body: "숙련된 치료사가 손으로 관절·근육을 조정하는 치료입니다." },
    { heading: "방문 전 확인사항", body: "통증 부위와 기간을 기록해 가면 상담에 도움이 됩니다." }
  ],
  faq: [{ q: "치료 주기는 어떻게 되나요?", a: "상태에 따라 주 1~2회로 계획하는 경우가 많습니다." }],
  caution: "개인차가 있으며 정확한 진단은 의료진 상담이 필요합니다."
};

describe("답변 페이지 조립(순수)", () => {
  it("FAQPage JSON-LD를 스키마 규격으로 생성한다", () => {
    const ld = buildFaqJsonLd(draft) as { "@context": string; "@graph": Array<Record<string, unknown>> };
    expect(ld["@context"]).toBe("https://schema.org");
    const faqPage = ld["@graph"].find((g) => g["@type"] === "FAQPage") as { mainEntity: Array<{ "@type": string }> };
    expect(faqPage.mainEntity).toHaveLength(1);
    expect(faqPage.mainEntity[0]["@type"]).toBe("Question");
    expect(ld["@graph"][0]["@type"]).toBe("Article");
  });

  it("마크다운이 BLUF 구조(제목 직후 핵심 답변)를 지킨다", () => {
    const md = buildAnswerPageMarkdown(draft);
    const lines = md.split("\n").filter(Boolean);
    expect(lines[0]).toBe(`# ${draft.title}`);
    expect(lines[1]).toBe(draft.summary); // 첫 문단 = 핵심 답변
    expect(md).toContain("## 자주 묻는 질문");
    expect(md).toContain(draft.caution);
    expect(md).toContain('"@type": "FAQPage"'); // 구조화 데이터 포함
  });

  it("FAQ 없는 초안은 FAQPage를 생략한다", () => {
    const ld = buildFaqJsonLd({ ...draft, faq: [] }) as { "@graph": Array<Record<string, unknown>> };
    expect(ld["@graph"].some((g) => g["@type"] === "FAQPage")).toBe(false);
  });
});
