import type { Diagram } from "@/features/diagram";
import type { DiagramToolHost } from "../tools/host";

/** A tool host over a fixed diagram; applying changes is recorded, not done. */
export function fixtureHost(diagram: Diagram): DiagramToolHost & {
  applied: Parameters<DiagramToolHost["applyChanges"]>[0][];
} {
  const applied: Parameters<DiagramToolHost["applyChanges"]>[0][] = [];
  return {
    applied,
    readDiagram: () => diagram,
    applyChanges: (changes) => {
      applied.push(changes);
      return { idByRef: {}, skipped: [] };
    },
    autoLayout: async () => undefined,
  };
}

export function fixtureDiagram(
  components: Diagram["snapshot"]["components"],
  connections: Diagram["snapshot"]["connections"] = {},
): Diagram {
  return {
    id: "fixture",
    name: "Fixture",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodeLayouts: {},
    edgeLayouts: {},
    snapshot: { components, connections, flows: {}, iconLibrary: {} },
  };
}
