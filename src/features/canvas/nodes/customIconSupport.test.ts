import { describe, expect, it } from "vitest";
import type { Component } from "@/features/diagram";
import { supportsCustomIcon } from "./customIconSupport";

function component(fields: Record<string, unknown>): Component {
  return { id: "n1", name: "n", description: "", parentId: null, ...fields } as Component;
}

describe("supportsCustomIcon", () => {
  it("offers an icon to a card created without the customIconId key", () => {
    expect(supportsCustomIcon(component({ type: "container" }))).toBe(true);
  });

  it("offers an icon to a cloud service, a panel and a note", () => {
    expect(supportsCustomIcon(component({ type: "aws-compute", cloudServiceId: "ec2" }))).toBe(
      true,
    );
    expect(supportsCustomIcon(component({ type: "panel" }))).toBe(true);
    expect(supportsCustomIcon(component({ type: "note" }))).toBe(true);
  });

  it("does not offer one to a reference, which draws the link glyph", () => {
    expect(supportsCustomIcon(component({ type: "shared-ref", refOf: "x" }))).toBe(false);
  });
});
