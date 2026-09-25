import { describe, expect, it } from "vitest";
import { paletteEntriesForCategory } from "@/features/elements/element.palette";
import { getElement } from "@/features/elements/element.registry";
import { PanelKind } from "@/features/diagram/enums";

/** The five service-blueprint lanes: palette content on the swimlane, not a new type. */
describe("service blueprint lane presets", () => {
  const entries = paletteEntriesForCategory("canvas").filter((entry) =>
    entry.key.startsWith("panel:blueprint-"),
  );

  it("offers the five lanes as swimlanes with a theme-token accent", () => {
    expect(entries.map((entry) => entry.key).sort()).toEqual([
      "panel:blueprint-backstage",
      "panel:blueprint-customer",
      "panel:blueprint-evidence",
      "panel:blueprint-onstage",
      "panel:blueprint-support",
    ]);
    for (const entry of entries) {
      expect(entry.type).toBe("panel");
      expect(entry.createOptions.panelKind).toBe(PanelKind.Swimlane);
      expect(entry.createOptions.laneAccent).toMatch(/^hsl\(var\(--[\w-]+\)\)$/);
    }
  });

  it("creates the evidence lane dashed and slate, with its label", () => {
    const evidence = entries.find((entry) => entry.key === "panel:blueprint-evidence")!;
    const lane = getElement("panel")!.model.createComponent(
      { id: "l", name: "Swimlane", description: "", parentId: null },
      evidence.createOptions,
    );
    expect(lane).toMatchObject({
      panelKind: PanelKind.Swimlane,
      panelColor: "hsl(var(--muted-foreground))",
      borderStyle: "dashed",
      swimlane: { laneColor: "hsl(var(--muted-foreground))", laneLabel: evidence.label },
    });
  });

  it("leaves a plain swimlane exactly as before", () => {
    const lane = getElement("panel")!.model.createComponent(
      { id: "l", name: "Swimlane", description: "", parentId: null },
      { panelKind: PanelKind.Swimlane },
    );
    expect(lane).not.toHaveProperty("borderStyle");
    expect(lane).toMatchObject({ swimlane: { laneColor: "#6366f1" } });
  });
});
