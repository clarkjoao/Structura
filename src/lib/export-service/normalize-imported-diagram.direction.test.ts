import { describe, expect, it } from "vitest";
import type { Diagram } from "@/features/diagram";
import { normalizeImportedDiagram } from "./normalize-imported-diagram";

function imported(extra: Record<string, unknown>): Diagram {
  return {
    id: "d",
    name: "d",
    level: "context",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...extra,
  } as Diagram;
}

describe("normalizeImportedDiagram — direction and layout settings", () => {
  it("keeps a valid direction and valid settings", () => {
    const out = normalizeImportedDiagram(
      imported({ direction: "TB", layoutSettings: { mode: "automatic", layerGap: 5000 } }),
    );
    expect(out.direction).toBe("TB");
    expect(out.layoutSettings).toEqual({ mode: "automatic", layerGap: 600 });
  });

  it("drops what it does not recognise instead of storing it", () => {
    const out = normalizeImportedDiagram(
      imported({ direction: "diagonal", layoutSettings: { density: "huge" } }),
    );
    expect("direction" in out).toBe(false);
    expect("layoutSettings" in out).toBe(false);
  });
});
