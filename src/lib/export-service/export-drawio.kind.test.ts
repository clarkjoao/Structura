import { beforeEach, describe, expect, it } from "vitest";
import i18n from "@/infrastructure/i18n";
import "@/features/elements/bootstrap";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { createKindDiagram } from "@/features/diagram-kinds/actions";
import { applyKindTextBuild, buildKindText } from "@/features/canvas/chrome/kindTextCapture";
import { exportDrawio } from "./export-drawio";
import { parseDrawioXml } from "./import-drawio";

registerBuiltInDiagramKinds();

function phasedJourney() {
  const { diagram } = createKindDiagram({
    name: `X ${Math.random()}`,
    level: "context",
    kindId: "guided",
  });
  useDiagramStore.getState().openDiagram(diagram.id);
  const built = buildKindText("## Discover\nUsuário: A\nB\n## Buy\nC");
  if (!built || !("edit" in built)) throw new Error("no build");
  applyKindTextBuild(built);
  return diagram.id;
}

const current = (id: string) => useDiagramStore.getState().diagrams[id]!;

describe("draw.io export of a guided journey's phases", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("adds the phases and separators in a locked layer", () => {
    const xml = exportDrawio(current(phasedJourney()), {});
    expect(xml).toContain('value="Fases" style="locked=1;" parent="0"');
    expect(xml.match(/id="structura-phase-[^s"][^"]*" value="(Discover|Buy)"/g)).toHaveLength(2);
    expect(xml).toContain('id="structura-phase-separator-');
    expect(xml).not.toContain("structura-emotion-curve");
  });

  it("adds nothing in freehand mode", () => {
    const id = phasedJourney();
    useDiagramStore.getState().setKindMode(id, "freehand");
    expect(exportDrawio(current(id), {})).not.toContain("structura-decorations");
  });

  it("is ignored when the file is imported back", () => {
    const id = phasedJourney();
    const withBand = parseDrawioXml(exportDrawio(current(id), {}), { x: 0, y: 0 }, {});
    useDiagramStore.getState().setKindMode(id, "freehand");
    const without = parseDrawioXml(exportDrawio(current(id), {}), { x: 0, y: 0 }, {});
    const names = (d: typeof withBand) => d.components.map((c) => c.name).sort();
    expect(names(withBand)).toEqual(names(without));
    expect(withBand.connections).toHaveLength(without.connections.length);
    expect(names(withBand)).not.toContain("Discover");
  });
});
