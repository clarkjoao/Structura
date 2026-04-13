import type { createDiagramStore } from "@/features/diagram/store/diagram.store";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import type { Diagram } from "@/features/diagram";
import { PanelKind } from "@/features/diagram";

export interface StressSeedResult {
  store: ReturnType<typeof createDiagramStore>;
  diagramId: string;
  
  panelsByLevel: string[][];
  
  leafNodeIds: string[];
  
  allComponentIds: string[];
  
  totalCount: number;
}


export function seedStressDiagram(options?: {
  targetCount?: number;
  maxDepth?: number;
  panelsPerLevel?: number;
  leavesPerDeepestPanel?: number;
}): StressSeedResult {
  const {
    targetCount = 500,
    maxDepth = 6,
    panelsPerLevel = 10,
    leavesPerDeepestPanel = 5,
  } = options ?? {};

  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("StressTest", "context");
  store.getState().openDiagram(diagram.id);

  const panelsByLevel: string[][] = [];
  const leafNodeIds: string[] = [];
  const allComponentIds: string[] = [];
  let created = 0;

  for (let level = 0; level < maxDepth; level++) {
    const levelPanels: string[] = [];

    for (let i = 0; i < panelsPerLevel && created < targetCount; i++) {
      const parentId =
        level === 0
          ? null
          : panelsByLevel[level - 1]![i % panelsByLevel[level - 1]!.length]!;

      const panelX = (i % 5) * 700 + level * 50;
      const panelY = Math.floor(i / 5) * 500 + level * 50;

      const panel = store.getState().addComponent(
        "panel",
        `Panel-L${level}-${i}`,
        parentId,
        { x: panelX, y: panelY },
        undefined,
        PanelKind.Default,
      );

      levelPanels.push(panel.id);
      allComponentIds.push(panel.id);
      created++;
    }

    panelsByLevel.push(levelPanels);
  }

  const deepestPanels = panelsByLevel[maxDepth - 1] ?? [];
  for (const panelId of deepestPanels) {
    for (let i = 0; i < leavesPerDeepestPanel && created < targetCount; i++) {
      const leaf = store.getState().addComponent(
        "system",
        `Leaf-${created}`,
        panelId,
        { x: 40 + i * 200, y: 60 },
      );
      leafNodeIds.push(leaf.id);
      allComponentIds.push(leaf.id);
      created++;
    }
  }

  for (let level = maxDepth - 2; level >= 0 && created < targetCount; level--) {
    for (const panelId of panelsByLevel[level] ?? []) {
      if (created >= targetCount) break;
      const leaf = store.getState().addComponent(
        "container",
        `MidLeaf-${created}`,
        panelId,
        { x: 40, y: 200 },
      );
      leafNodeIds.push(leaf.id);
      allComponentIds.push(leaf.id);
      created++;
    }
  }

  while (created < targetCount) {
    const leaf = store.getState().addComponent(
      "component",
      `RootLeaf-${created}`,
      null,
      { x: (created % 20) * 220, y: Math.floor(created / 20) * 140 },
    );
    leafNodeIds.push(leaf.id);
    allComponentIds.push(leaf.id);
    created++;
  }

  const connLeaves = leafNodeIds.slice(0, Math.min(100, leafNodeIds.length));
  for (let i = 0; i < connLeaves.length - 1; i += 2) {
    store.getState().addConnection(connLeaves[i]!, connLeaves[i + 1]!, "uses");
  }

  return {
    store,
    diagramId: diagram.id,
    panelsByLevel,
    leafNodeIds,
    allComponentIds,
    totalCount: created,
  };
}

export function getSnapshot(store: ReturnType<typeof createDiagramStore>): {
  diagram: Diagram;
  components: Diagram["snapshot"]["components"];
  nodeLayouts: Diagram["nodeLayouts"];
  connections: Diagram["snapshot"]["connections"];
} {
  const state = store.getState();
  const activeId = state.activeDiagramId;
  if (!activeId) {
    throw new Error("stress-helpers: no active diagram");
  }
  const diagram = state.diagrams[activeId];
  if (!diagram) {
    throw new Error("stress-helpers: active diagram missing");
  }
  return {
    diagram,
    components: diagram.snapshot.components,
    nodeLayouts: diagram.nodeLayouts,
    connections: diagram.snapshot.connections,
  };
}

export function measureMs(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

export async function measureMsAsync(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}
