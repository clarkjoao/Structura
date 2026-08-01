import { describe, it, expect } from "vitest";
import {
  SPACING,
  LAYOUT,
  SEMANTIC_PALETTE,
  C4_STYLE,
  MAX_PRIMARY_NODES,
  LABEL_MASK,
  labelMaskWidth,
  snapToGrid,
  densityForNodeCount,
} from "./constants";
import { CUSTOM_NODE_TYPOGRAPHY } from "./typography";

describe("spacing scales with density", () => {
  it("widens gaps as diagrams get denser", () => {
    expect(SPACING.simple.colGap).toBeLessThan(SPACING.medium.colGap);
    expect(SPACING.medium.colGap).toBeLessThan(SPACING.complex.colGap);
    expect(SPACING.simple.rowGap).toBeLessThan(SPACING.medium.rowGap);
    expect(SPACING.medium.rowGap).toBeLessThan(SPACING.complex.rowGap);
  });

  it("selects a bucket from node count", () => {
    expect(densityForNodeCount(1)).toBe("simple");
    expect(densityForNodeCount(5)).toBe("simple");
    expect(densityForNodeCount(6)).toBe("medium");
    expect(densityForNodeCount(10)).toBe("medium");
    expect(densityForNodeCount(11)).toBe("complex");
    expect(densityForNodeCount(200)).toBe("complex");
  });
});

describe("node size bounds stay consistent with the node CSS", () => {
  it("mirrors the CustomNode shell rather than a wider independent range", () => {
    // The shell clamps rendered width; measuring outside it would guarantee divergence.
    expect(LAYOUT.NODE_MIN_W).toBe(CUSTOM_NODE_TYPOGRAPHY.box.minWidth);
    expect(LAYOUT.NODE_MAX_W).toBe(CUSTOM_NODE_TYPOGRAPHY.box.maxWidth);
    expect(LAYOUT.NODE_MIN_H).toBe(CUSTOM_NODE_TYPOGRAPHY.box.minHeight);
  });

  it("keeps min below max on both axes", () => {
    expect(LAYOUT.NODE_MIN_W).toBeLessThan(LAYOUT.NODE_MAX_W);
    expect(LAYOUT.NODE_MIN_H).toBeLessThan(LAYOUT.NODE_MAX_H);
  });
});

describe("anchor clamp", () => {
  it("keeps anchors off the exact corners", () => {
    const [low, high] = LAYOUT.ANCHOR_CLAMP;
    expect(low).toBeGreaterThan(0);
    expect(high).toBeLessThan(1);
    expect(low).toBeLessThan(high);
  });
});

describe("palettes", () => {
  it("gives every semantic role a distinct fill", () => {
    const fills = Object.values(SEMANTIC_PALETTE).map((entry) => entry.fill);
    expect(new Set(fills).size).toBe(fills.length);
  });

  it("pairs every role with a stroke", () => {
    for (const [role, entry] of Object.entries(SEMANTIC_PALETTE)) {
      expect(entry.fill, role).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(entry.stroke, role).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("uses the official C4 colours", () => {
    expect(C4_STYLE.person.fill).toBe("#083F75");
    expect(C4_STYLE.system.fill).toBe("#1061B0");
    expect(C4_STYLE.container.fill).toBe("#23A2D9");
    expect(C4_STYLE.component.fill).toBe("#63BEF2");
    expect(C4_STYLE["external-system"].fill).toBe("#8C8496");
  });
});

describe("labelMaskWidth", () => {
  it("grows with label length", () => {
    expect(labelMaskWidth("HTTPS")).toBeGreaterThan(labelMaskWidth("TCP"));
  });

  it("counts CJK characters as two units", () => {
    const ascii = labelMaskWidth("ab");
    const cjk = labelMaskWidth("日本");
    expect(cjk).toBeGreaterThan(ascii);
    expect(cjk - LABEL_MASK.PADDING).toBeCloseTo((ascii - LABEL_MASK.PADDING) * 2, 5);
  });

  it("returns just the padding for an empty label", () => {
    expect(labelMaskWidth("")).toBe(LABEL_MASK.PADDING);
  });
});

describe("snapToGrid", () => {
  it("snaps to the nearest multiple of the grid", () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(4)).toBe(0);
    expect(snapToGrid(5)).toBe(10);
    expect(snapToGrid(14)).toBe(10);
    expect(snapToGrid(283)).toBe(280);
  });

  it("handles negative coordinates symmetrically", () => {
    expect(snapToGrid(-4)).toBe(-0);
    expect(snapToGrid(-14)).toBe(-10);
  });

  it("accepts a custom grid", () => {
    expect(snapToGrid(17, 5)).toBe(15);
  });
});

describe("composition limits", () => {
  it("caps primary nodes at the readability threshold", () => {
    expect(MAX_PRIMARY_NODES).toBe(12);
  });
});
