import { describe, it, expect } from "vitest";
import { selectCompetitors, isOwnBrand, normalizeName } from "./competitor-filter";
import type { LocalPlace } from "@/server/integrations/naver-local";

const P = (name: string, category = "의원"): LocalPlace =>
  ({ name, category, address: "", roadAddress: "", link: "", lng: 0, lat: 0 } as unknown as LocalPlace);

describe("normalizeName", () => {
  it("공백·의료기관 접미어를 제거한다", () => {
    expect(normalizeName("아름다운 피부과의원")).toBe("아름다운피부과");
    expect(normalizeName("쁘띠365의원")).toBe("쁘띠365");
  });
});

describe("isOwnBrand", () => {
  it("정규화 상호 상호포함으로 자기병원을 판별한다", () => {
    expect(isOwnBrand("미소진의원", "미소진")).toBe(true);
    expect(isOwnBrand("미소진 피부과의원", "미소진의원")).toBe(true);
    expect(isOwnBrand("아름다운피부과의원", "미소진")).toBe(false);
  });
  it("brand 없으면 항상 false", () => {
    expect(isOwnBrand("아무의원", null)).toBe(false);
  });
});

describe("selectCompetitors", () => {
  const raw = [
    P("쁘띠365의원"),
    P("블리비의원 춘천점"),
    P("예쁨주의쁨의원 춘천"),
    P("아름다운피부과의원", "피부과"),
    P("피부사랑피부과의원", "피부과")
  ];

  it("진료과 글자 완전일치가 아닌 ○○의원도 유지한다(2곳만 나오던 버그 방지)", () => {
    const { places } = selectCompetitors(raw, { specialty: "피부과", limit: 5 });
    expect(places).toHaveLength(5);
    const names = places.map((p) => p.name);
    expect(names).toContain("쁘띠365의원");
    expect(names).toContain("블리비의원 춘천점");
  });

  it("진료과 관련 상호를 앞으로 정렬한다", () => {
    const { places, filtered } = selectCompetitors(raw, { specialty: "피부과", limit: 5 });
    expect(places[0].name).toContain("피부과");
    expect(filtered).toBe(true);
  });

  it("자기병원(brand)을 제외한다", () => {
    const { places } = selectCompetitors(raw, { specialty: "피부과", brand: "아름다운", limit: 5 });
    expect(places.map((p) => p.name)).not.toContain("아름다운피부과의원");
    expect(places).toHaveLength(4);
  });

  it("명백한 이종(피부관리샵·약국)을 제외한다", () => {
    const withOff = [...raw, P("클라라피부관리", "피부관리"), P("온누리약국", "약국")];
    const { places } = selectCompetitors(withOff, { specialty: "피부과", limit: 10 });
    const names = places.map((p) => p.name);
    expect(names).not.toContain("클라라피부관리");
    expect(names).not.toContain("온누리약국");
  });

  it("limit로 상위 N만 반환한다", () => {
    const { places } = selectCompetitors(raw, { specialty: "피부과", limit: 3 });
    expect(places).toHaveLength(3);
  });
});
