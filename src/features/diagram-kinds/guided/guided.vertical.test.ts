import { describe, expect, it } from "vitest";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { kindContextFor } from "../context";
import { registerBuiltInDiagramKinds } from "../bootstrap";
import { createKindDiagram } from "../actions";
import { kindMarkersFor } from "../markers";
import { overlayBounds } from "../overlay.geometry";
import { guidedSetVisibilityLine } from "./guided.edits";
import { guidedHarness } from "./guided.harness";
import { readGuided } from "./guided.model";
import { guidedOverlay } from "./guided.overlay";
import { buildOutline } from "./guided.outline.build";
import { parseOutline } from "./guided.outline.parse";
import { serializeGuidedOutline } from "./guided.outline.serialize";
import { isMermaid, parseMermaid } from "./guided.mermaid.parse";

registerBuiltInDiagramKinds();

type Harness = ReturnType<typeof guidedHarness>;

function add(h: Harness, text: string) {
  const parsed = isMermaid(text) ? parseMermaid(text) : parseOutline(text);
  const built = buildOutline(h.diagram(), parsed, [h.startId], kindContextFor(h.diagram()));
  if (!("edit" in built)) throw new Error(JSON.stringify(built));
  h.apply(built.edit);
}

const JOURNEY = "User:\n---\nSystem:\n## Descobrir\nUser, Atendente: A\nSystem: B\n## Comprar\nC";

describe("vertical guided journeys", () => {
  it("are created top to bottom: lanes as columns, the start at the top", () => {
    const { diagram } = createKindDiagram({
      name: `V ${Math.random()}`,
      level: "context",
      kindId: "guided",
      direction: "TB",
    });
    const d = useDiagramStore.getState().diagrams[diagram.id]!;
    expect(d.direction).toBe("TB");
    const reading = readGuided(d);
    for (const lane of reading.lanes) {
      const component = reading.components[lane.id] as { swimlane?: { orientation?: string } };
      expect(component.swimlane?.orientation).toBe("vertical");
    }
    const [first, second] = reading.lanes.map((lane) => d.nodeLayouts[lane.id]!);
    expect(second!.x).toBeGreaterThan(first!.x);
  });

  it("take a Mermaid block's direction when the journey is empty, and keep their own otherwise", () => {
    const h = guidedHarness();
    add(h, "flowchart TD\n  subgraph User\n    a[Pede] --> b[Recebe]\n  end");
    expect(h.diagram().direction).toBe("TB");
    for (const lane of h.reading().lanes) {
      const component = h.reading().components[lane.id] as { swimlane?: { orientation?: string } };
      expect(component.swimlane?.orientation).toBe("vertical");
    }
    h.store.getState().undo();
    expect(h.diagram().direction).toBeUndefined();

    const kept = guidedHarness();
    add(kept, "User: A\nB");
    add(kept, "flowchart TD\n  subgraph User\n    c[C] --> d[D]\n  end");
    expect(kept.diagram().direction).toBeUndefined();

    const left = guidedHarness("TB");
    add(left, "swimlane-beta LR\n  subgraph User\n    a[A] --> b[B]\n  end");
    expect(left.diagram().direction).toBeUndefined();
  });

  it("behave the same: same text, band and line along y, tags on the steps", () => {
    const lr = guidedHarness();
    add(lr, JOURNEY);
    const tb = guidedHarness("TB");
    add(tb, JOURNEY);
    tb.apply(
      guidedSetVisibilityLine(
        tb.diagram(),
        tb.reading().lanes.find((l) => l.name === "System")!.id,
      ),
    );
    lr.apply(
      guidedSetVisibilityLine(
        lr.diagram(),
        lr.reading().lanes.find((l) => l.name === "System")!.id,
      ),
    );
    const text = (h: Harness) => serializeGuidedOutline(h.diagram(), kindContextFor(h.diagram()));
    expect(text(tb)).toBe(text(lr));
    const overlay = guidedOverlay(tb.diagram())!;
    expect(overlay.axis).toBe("y");
    expect(overlay.segments.map((s) => s.label)).toEqual(["Descobrir", "Comprar"]);
    const firstLane = tb.reading().lanes[0]!;
    // The band sits left of the lanes; the line runs down between them.
    expect(overlay.at + overlay.depth).toBeLessThan(tb.diagram().nodeLayouts[firstLane.id]!.x);
    const line = overlay.lines![0]!;
    const system = tb.reading().lanes.find((l) => l.name === "System")!;
    expect(line.across).toBe(tb.diagram().nodeLayouts[system.id]!.x);
    const bounds = overlayBounds(overlay)!;
    expect(bounds.height).toBeGreaterThan(bounds.width / 4);
    const a = [...tb.reading().steps.values()].find((s) => s.name === "A")!;
    expect(kindMarkersFor(tb.diagram()).tags.get(a.id)?.text).toBe("+ Atendente");
  });
});
