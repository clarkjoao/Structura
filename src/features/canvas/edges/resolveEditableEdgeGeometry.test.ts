import { describe, expect, it } from "vitest";
import { resolveLabelOffset } from "./resolveEditableEdgeGeometry";

describe("resolveLabelOffset", () => {
  it("takes the projection's stamp when the diagram has an offset", () => {
    expect(resolveLabelOffset({ layoutLabelOffset: 0.2, legacyLabelPosition: 0.8 })).toBe(0.2);
  });

  it("falls back to the legacy label position when the diagram has none", () => {
    expect(resolveLabelOffset({ layoutLabelOffset: null, legacyLabelPosition: 0.8 })).toBe(0.8);
    expect(resolveLabelOffset({ layoutLabelOffset: undefined, legacyLabelPosition: 0.8 })).toBe(
      0.8,
    );
    expect(
      resolveLabelOffset({ layoutLabelOffset: null, legacyLabelPosition: undefined }),
    ).toBeUndefined();
  });
});
