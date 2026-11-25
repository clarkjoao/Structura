import { describe, expect, it } from "vitest";
import { isSharedRefComponent } from "@/features/diagram/model/component.guards";
import type { Diagram } from "@/features/diagram/model/diagram.types";
import { useDiagramStore } from "@/features/diagram";
import { arrangePreviewDiagram, arrangeSignature, withContentOf } from "./arrange";
import { buildPreviewDiagram } from "./build-diagram";
import type { PreviewGraph } from "./protocol";

/**
 * A chain of five that loops back: laid out in layers, one connection points four columns back,
 * and the canvas rules end it on a reference beside its consumer — in the embed too.
 */
const names = ["a", "b", "c", "d", "e"];
const chain = (description = ""): PreviewGraph => ({
  components: names.map((name, i) => ({
    key: `System/${name}`,
    name,
    type: "system",
    description,
    x: i * 300,
    y: 0,
  })),
  connections: [
    ...names.slice(1).map((name, i) => ({
      source: `System/${names[i]}`,
      target: `System/${name}`,
      label: "calls",
    })),
    { source: "System/e", target: "System/a", label: "retries" },
  ],
});

const refsOf = (diagram: Diagram) =>
  Object.values(diagram.snapshot.components).filter(isSharedRefComponent);

const positions = (diagram: Diagram) =>
  Object.fromEntries(Object.values(diagram.nodeLayouts).map((l) => [l.elementId, [l.x, l.y]]));

describe("arrangePreviewDiagram", () => {
  it("ends a far back-connection on a reference, as the canvas does", async () => {
    const appBefore = useDiagramStore.getState().diagrams;
    const arranged = await arrangePreviewDiagram(buildPreviewDiagram(chain()));
    const refs = refsOf(arranged);
    expect(refs).toHaveLength(1);
    const ref = refs[0]!;
    // The one connection that loops back now ends on the reference, under its own id.
    const onRef = Object.values(arranged.snapshot.connections).filter(
      (c) => c.targetId === ref.id || c.sourceId === ref.id,
    );
    expect(onRef).toHaveLength(1);
    expect(arranged.snapshot.connections[onRef[0]!.id]).toBeDefined();
    expect(arranged.nodeLayouts[ref.id]).toBeDefined();
    // The app's store is never touched.
    expect(useDiagramStore.getState().diagrams).toBe(appBefore);
  });

  it("makes no reference with references off", async () => {
    const arranged = await arrangePreviewDiagram(buildPreviewDiagram(chain()), {
      references: "off",
    });
    expect(refsOf(arranged)).toHaveLength(0);
  });

  it("keeps the picture of a text edit, with the new text", async () => {
    const before = buildPreviewDiagram(chain());
    const arranged = await arrangePreviewDiagram(before);
    const after = buildPreviewDiagram(chain("new"));
    expect(arrangeSignature(after)).toBe(arrangeSignature(before));

    const patched = withContentOf(arranged, after);
    expect(positions(patched)).toEqual(positions(arranged));
    expect(patched.snapshot.components["System/a"]!.description).toBe("new");
    // The connection on the reference still ends there.
    const ref = refsOf(patched)[0]!;
    expect(Object.values(patched.snapshot.connections).some((c) => c.targetId === ref.id)).toBe(
      true,
    );
  });

  it("changes signature with the structure or the settings", () => {
    const base = buildPreviewDiagram(chain());
    const fewer = chain();
    fewer.connections.pop();
    expect(arrangeSignature(buildPreviewDiagram(fewer))).not.toBe(arrangeSignature(base));
    expect(arrangeSignature(base, { density: "compact" })).not.toBe(arrangeSignature(base));
    // Defaults are no change.
    expect(arrangeSignature(base, { references: "rules" })).toBe(arrangeSignature(base));
  });
});
