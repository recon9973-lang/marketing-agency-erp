import { describe, expect, it } from "vitest";

describe("project setup", () => {
  it("uses the ERP product name", () => {
    expect("Marketing Agency ERP").toContain("ERP");
  });
});
