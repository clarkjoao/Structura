import { beforeAll, describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { Component, NodeLayout } from "@/features/diagram";
import { seedStressDiagram, getSnapshot, measureMs, type StressSeedResult } from "./stress-helpers";
import {
  buildChildrenIndex,
  isPanelComponent,
  isApiGroupComponent,
  isAncestorLocked,
} from "@/features/diagram";
import {
  buildCollapsedPanelIds,
  computeNodeVisibility,
} from "@/features/canvas/nodes/nodeVisibility";
import {
  buildPanelIds,
  buildConnectionCountPerNode,
} from "@/features/canvas/edges/connectionDerivations";
import {
  findPanelContainingPoint,
  resolveAbsolutePosition,
  resolveAbsolutePositionFromNodes,
} from "@/features/canvas/models/panelParenting";
import { resolveNodeDescriptor } from "@/features/canvas/nodes/node-types";

function buildNodeStubs(
  components: Record<string, Component>,
  nodeLayouts: Record<string, NodeLayout>,
): Node[] {
  return Object.values(components).map((comp) => {
    const layout = nodeLayouts[comp.id];
    return {
      id: comp.id,
      position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
      data: {},
      type: isPanelComponent(comp) ? "panel" : "c4",
      parentId: comp.parentId ?? undefined,
      style: layout?.width ? { width: layout.width, height: layout.height ?? 400 } : undefined,
    } as Node;
  });
}

describe("Stress: Canvas pipeline with 500 elements", () => {
  let stress: StressSeedResult;

  beforeAll(() => {
    stress = seedStressDiagram({ targetCount: 500 });
  });

  it("buildChildrenIndex with 500 elements completes in under 20ms", () => {
    const { store } = stress;
    const { components } = getSnapshot(store);
    const ms = measureMs(() => {
      buildChildrenIndex(components);
    });
    expect(ms).toBeLessThan(20);
  });

  it("buildChildrenIndex produces correct counts for 6-level hierarchy", () => {
    const { store, panelsByLevel } = stress;
    const { components } = getSnapshot(store);
    const childrenIndex = buildChildrenIndex(components);

    for (const panelId of panelsByLevel[0]!) {
      const children = childrenIndex.get(panelId);
      expect(children).toBeDefined();
      expect(children!.size).toBeGreaterThan(0);
    }
  });

  it("topological sort by depth handles 500 elements in under 40ms", () => {
    const { store } = stress;
    const { components } = getSnapshot(store);
    const comps = Object.values(components);

    function getParentDepth(comp: Component, compsMap: Record<string, Component>): number {
      let depth = 0;
      let currentId = comp.parentId;
      const visited = new Set<string>();
      while (currentId && compsMap[currentId] && !visited.has(currentId)) {
        visited.add(currentId);
        depth++;
        currentId = compsMap[currentId]!.parentId;
      }
      return depth;
    }

    let sorted: typeof comps = [];
    const ms = measureMs(() => {
      const depthCache = new Map<string, number>();
      sorted = [...comps].sort((a, b) => {
        let dA = depthCache.get(a.id);
        if (dA === undefined) {
          dA = getParentDepth(a, components);
          depthCache.set(a.id, dA);
        }
        let dB = depthCache.get(b.id);
        if (dB === undefined) {
          dB = getParentDepth(b, components);
          depthCache.set(b.id, dB);
        }
        const aIsGroup = isPanelComponent(a) || isApiGroupComponent(a);
        const bIsGroup = isPanelComponent(b) || isApiGroupComponent(b);
        if (aIsGroup && !bIsGroup) return -1;
        if (!aIsGroup && bIsGroup) return 1;
        return dA - dB;
      });
    });
    expect(ms).toBeLessThan(40);

    const seenIds = new Set<string>();
    for (const comp of sorted) {
      if (comp.parentId) {
        expect(seenIds.has(comp.parentId)).toBe(true);
      }
      seenIds.add(comp.id);
    }
  });

  it("buildCollapsedPanelIds with 500 elements completes in under 10ms", () => {
    const { store } = stress;
    const { components } = getSnapshot(store);
    const ms = measureMs(() => {
      buildCollapsedPanelIds(components);
    });
    expect(ms).toBeLessThan(10);
  });

  it("buildPanelIds with 500 elements completes in under 10ms", () => {
    const { store } = stress;
    const { components } = getSnapshot(store);
    const comps = Object.values(components);
    const ms = measureMs(() => {
      buildPanelIds(comps);
    });
    expect(ms).toBeLessThan(10);
  });

  it("pre-computing locked set for 500 elements completes in under 40ms", () => {
    const { store } = stress;
    const { components } = getSnapshot(store);
    const ms = measureMs(() => {
      const lockedIds = new Set<string>();
      for (const comp of Object.values(components)) {
        if (comp.locked === true || isAncestorLocked(comp, components)) {
          lockedIds.add(comp.id);
        }
      }
      expect(lockedIds.size).toBeGreaterThanOrEqual(0);
    });
    expect(ms).toBeLessThan(40);
  });

  it("resolveAbsolutePosition for deepest node walks parent chain correctly", () => {
    const { store, panelsByLevel, leafNodeIds } = stress;
    const { components, nodeLayouts } = getSnapshot(store);

    const deepestPanel = panelsByLevel[5]![0]!;
    const deepLeaf = leafNodeIds.find((id) => components[id]!.parentId === deepestPanel);
    if (!deepLeaf) {
      throw new Error("expected a leaf under deepest panel");
    }

    const absPos = resolveAbsolutePosition(
      deepLeaf,
      nodeLayouts[deepLeaf]!,
      components,
      nodeLayouts,
    );

    let expectedX = nodeLayouts[deepLeaf]!.x;
    let expectedY = nodeLayouts[deepLeaf]!.y;
    let currentId: string | null | undefined = components[deepLeaf]!.parentId;
    while (currentId) {
      const layout = nodeLayouts[currentId];
      if (layout) {
        expectedX += layout.x;
        expectedY += layout.y;
      }
      currentId = components[currentId]?.parentId ?? null;
    }

    expect(absPos.x).toBeCloseTo(expectedX, 5);
    expect(absPos.y).toBeCloseTo(expectedY, 5);
  });

  it("resolveAbsolutePosition for all 500 elements completes in under 40ms", () => {
    const { store, allComponentIds } = stress;
    const { components, nodeLayouts } = getSnapshot(store);
    const ms = measureMs(() => {
      for (const id of allComponentIds) {
        resolveAbsolutePosition(id, nodeLayouts[id] ?? { x: 0, y: 0 }, components, nodeLayouts);
      }
    });
    expect(ms).toBeLessThan(40);
  });

  it("resolveAbsolutePositionFromNodes matches resolveAbsolutePosition", () => {
    const { store, leafNodeIds } = stress;
    const { components, nodeLayouts } = getSnapshot(store);
    const nodes = buildNodeStubs(components, nodeLayouts);

    for (const leafId of leafNodeIds.slice(0, 20)) {
      const fromStore = resolveAbsolutePosition(
        leafId,
        nodeLayouts[leafId]!,
        components,
        nodeLayouts,
      );
      const fromNodes = resolveAbsolutePositionFromNodes(leafId, nodes);
      expect(fromNodes.x).toBeCloseTo(fromStore.x, 5);
      expect(fromNodes.y).toBeCloseTo(fromStore.y, 5);
    }
  });

  it("findPanelContainingPoint returns innermost panel at deepest level", () => {
    const { store, panelsByLevel } = stress;
    const { components, nodeLayouts } = getSnapshot(store);
    const nodes = buildNodeStubs(components, nodeLayouts);

    for (const deepPanelId of panelsByLevel[5]!.slice(0, 3)) {
      const absPos = resolveAbsolutePosition(
        deepPanelId,
        nodeLayouts[deepPanelId]!,
        components,
        nodeLayouts,
      );
      const testX = absPos.x + 80;
      const testY = absPos.y + 80;

      const found = findPanelContainingPoint(
        nodes,
        testX,
        testY,
        undefined,
        nodeLayouts,
        components,
      );
      expect(found).toBeDefined();
      expect(isPanelComponent(components[found!.id]!)).toBe(true);
    }
  });

  it("findPanelContainingPoint with 500 nodes completes in under 30ms", () => {
    const { store } = stress;
    const { components, nodeLayouts } = getSnapshot(store);
    const nodes = buildNodeStubs(components, nodeLayouts);

    const ms = measureMs(() => {
      for (let i = 0; i < 50; i++) {
        findPanelContainingPoint(nodes, i * 100, i * 50, undefined, nodeLayouts, components);
      }
    });
    expect(ms).toBeLessThan(30);
  });

  it("buildConnectionCountPerNode with seeded connections completes in under 10ms", () => {
    const { store } = stress;
    const { connections } = getSnapshot(store);
    const conns = Object.values(connections);
    const ms = measureMs(() => {
      buildConnectionCountPerNode(conns);
    });
    expect(ms).toBeLessThan(10);
  });

  it("full node-build pipeline for 500 elements completes in under 200ms", () => {
    const { store } = stress;
    const { components, nodeLayouts } = getSnapshot(store);

    const ms = measureMs(() => {
      const comps = Object.values(components);
      const panelIds = buildPanelIds(comps);
      const childrenIndex = buildChildrenIndex(components);
      const collapsedPanelIds = buildCollapsedPanelIds(components);
      const selectedNodeIds = new Set<string>();
      const highlightedNodeIds = new Set<string>();

      const lockedIds = new Set<string>();
      for (const comp of comps) {
        if (comp.locked === true || isAncestorLocked(comp, components)) {
          lockedIds.add(comp.id);
        }
      }

      const depthCache = new Map<string, number>();
      function getDepth(comp: Component): number {
        if (depthCache.has(comp.id)) return depthCache.get(comp.id)!;
        let depth = 0;
        let currentId = comp.parentId;
        const visited = new Set<string>();
        while (currentId && components[currentId] && !visited.has(currentId)) {
          visited.add(currentId);
          depth++;
          currentId = components[currentId]!.parentId;
        }
        depthCache.set(comp.id, depth);
        return depth;
      }

      const visible = comps.filter((c) => !!nodeLayouts[c.id]);
      visible.sort((a, b) => {
        const aG = isPanelComponent(a) || isApiGroupComponent(a);
        const bG = isPanelComponent(b) || isApiGroupComponent(b);
        if (aG && !bG) return -1;
        if (!aG && bG) return 1;
        return getDepth(a) - getDepth(b);
      });

      for (const comp of visible) {
        const layout = nodeLayouts[comp.id];
        const descriptor = resolveNodeDescriptor(comp);
        computeNodeVisibility(
          comp,
          descriptor,
          layout,
          panelIds,
          selectedNodeIds,
          highlightedNodeIds,
          collapsedPanelIds,
          false,
          null,
          components,
        );
        if (isPanelComponent(comp)) {
          const _childCount = childrenIndex.get(comp.id)?.size ?? 0;
          void _childCount;
        }
        const _isLocked = lockedIds.has(comp.id);
        void _isLocked;
      }
    });

    expect(ms).toBeLessThan(200);
  });
});
