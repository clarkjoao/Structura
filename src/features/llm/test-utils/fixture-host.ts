import type { ChangeBatchReceipt, Diagram } from "@/features/diagram";
import type { DiagramToolHost } from "../tools/host";

/**
 * A tool host over a fixed diagram; applying changes is recorded, not done.
 * Every applied batch gets a receipt; reverting one is recorded too, and a
 * batch stays "in history" until reverted or `undoAll` runs.
 */
export function fixtureHost(diagram: Diagram): DiagramToolHost & {
  applied: Parameters<DiagramToolHost["applyChanges"]>[0][];
  reverted: ChangeBatchReceipt[];
  undoAll: () => void;
} {
  const applied: Parameters<DiagramToolHost["applyChanges"]>[0][] = [];
  const reverted: ChangeBatchReceipt[] = [];
  const live = new Set<ChangeBatchReceipt>();
  return {
    applied,
    reverted,
    undoAll: () => live.clear(),
    readDiagram: () => diagram,
    applyChanges: (changes) => {
      applied.push(changes);
      return { idByRef: {}, skipped: [] };
    },
    autoLayout: async () => undefined,
    takeReceipt: () => {
      const receipt = {
        diagramId: diagram.id,
        checkpoint: {} as ChangeBatchReceipt["checkpoint"],
        after: { snapshot: diagram.snapshot },
      };
      live.add(receipt);
      return receipt;
    },
    revertChanges: (receipt) => {
      if (!live.delete(receipt)) return false;
      reverted.push(receipt);
      return true;
    },
    isInHistory: (receipt) => live.has(receipt),
    removeElements: () => undefined,
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
