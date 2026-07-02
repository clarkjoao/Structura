import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { seedStressDiagram, getSnapshot, measureMs, type StressSeedResult } from "./stress-helpers";
import {
  buildChildrenIndex,
  getDescendantIdsFromIndex,
  isPanelComponent,
} from "@/features/diagram";
import { HISTORY_COALESCE_MS } from "@/features/diagram/store/store.constants";

describe("Stress: 500 elements with 6-level nested panels", () => {
  describe("seed & structure", () => {
    let structureSeed: StressSeedResult;

    beforeAll(() => {
      structureSeed = seedStressDiagram({ targetCount: 500 });
    });

    it("seeds 500 components with correct parent chain up to 6 levels", () => {
      const { totalCount, panelsByLevel, store } = structureSeed;
      const { components } = getSnapshot(store);

      expect(totalCount).toBe(500);
      expect(Object.keys(components)).toHaveLength(500);
      expect(panelsByLevel).toHaveLength(6);

      for (let level = 1; level < panelsByLevel.length; level++) {
        for (const panelId of panelsByLevel[level]!) {
          const comp = components[panelId]!;
          expect(comp.parentId).not.toBeNull();
          expect(panelsByLevel[level - 1]).toContain(comp.parentId);
        }
      }

      for (const panelId of panelsByLevel[0]!) {
        expect(components[panelId]!.parentId).toBeNull();
      }
    });

    it("all components have valid nodeLayouts", () => {
      const { store, allComponentIds } = structureSeed;
      const { nodeLayouts } = getSnapshot(store);

      for (const id of allComponentIds) {
        expect(nodeLayouts[id]).toBeDefined();
        expect(typeof nodeLayouts[id]!.x).toBe("number");
        expect(typeof nodeLayouts[id]!.y).toBe("number");
      }
    });

    it("children index correctly maps all parent-child relationships", () => {
      const { store } = structureSeed;
      const { components } = getSnapshot(store);

      const childrenIndex = buildChildrenIndex(components);

      for (const comp of Object.values(components)) {
        if (comp.parentId) {
          const siblings = childrenIndex.get(comp.parentId);
          expect(siblings).toBeDefined();
          expect(siblings!.has(comp.id)).toBe(true);
        }
      }
    });

    it("descendant traversal from root panels includes correct subtree", () => {
      const { store, panelsByLevel } = structureSeed;
      const { components } = getSnapshot(store);
      const childrenIndex = buildChildrenIndex(components);

      for (const rootPanelId of panelsByLevel[0]!) {
        const descendants = getDescendantIdsFromIndex(rootPanelId, childrenIndex);
        for (const descId of descendants) {
          let currentId: string | undefined = components[descId]!.parentId ?? undefined;
          let foundRoot = false;
          const guard = new Set<string>();
          while (currentId && !guard.has(currentId)) {
            guard.add(currentId);
            if (currentId === rootPanelId) {
              foundRoot = true;
              break;
            }
            currentId = components[currentId]?.parentId ?? undefined;
          }
          expect(foundRoot).toBe(true);
        }
      }
    });
  });

  describe("parenting operations", () => {
    it("setParent correctly reparents a leaf from deepest panel to root", () => {
      const { store, leafNodeIds } = seedStressDiagram();
      const deepLeaf = leafNodeIds[0]!;
      const { components: before } = getSnapshot(store);
      const originalParent = before[deepLeaf]!.parentId;
      expect(originalParent).not.toBeNull();

      store.getState().setParent(deepLeaf, null);

      const { components: after } = getSnapshot(store);
      expect(after[deepLeaf]!.parentId).toBeNull();
    });

    it("setParent correctly reparents a leaf to a different level panel", () => {
      const { store, leafNodeIds, panelsByLevel } = seedStressDiagram();
      const deepLeaf = leafNodeIds[0]!;
      const midPanel = panelsByLevel[2]![0]!;

      store.getState().setParent(deepLeaf, midPanel);

      const { components } = getSnapshot(store);
      expect(components[deepLeaf]!.parentId).toBe(midPanel);
    });

    it("commitNodeDrag atomically updates parentId and position", () => {
      const { store, leafNodeIds, panelsByLevel } = seedStressDiagram();
      const leaf = leafNodeIds[0]!;
      const targetPanel = panelsByLevel[1]![0]!;

      store.getState().commitNodeDrag(leaf, targetPanel, { x: 100, y: 200 });

      const { components, nodeLayouts } = getSnapshot(store);
      expect(components[leaf]!.parentId).toBe(targetPanel);
      expect(nodeLayouts[leaf]!.x).toBe(100);
      expect(nodeLayouts[leaf]!.y).toBe(200);
    });

    it("batchCommitNodeDrag applies multiple reparentings in single transaction", () => {
      const { store, leafNodeIds, panelsByLevel } = seedStressDiagram();
      const targetPanel = panelsByLevel[0]![0]!;
      const entries = leafNodeIds.slice(0, 10).map((id, i) => ({
        nodeId: id,
        newParentId: targetPanel,
        newPosition: { x: i * 50, y: 30 },
      }));

      store.getState().batchCommitNodeDrag(entries);

      const { components, nodeLayouts } = getSnapshot(store);
      for (const entry of entries) {
        expect(components[entry.nodeId]!.parentId).toBe(targetPanel);
        expect(nodeLayouts[entry.nodeId]!.x).toBe(entry.newPosition.x);
      }
    });
  });

  describe("history (fake timers)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-11T12:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("undo restores full 500-element state correctly", () => {
      const { store, leafNodeIds } = seedStressDiagram();
      const leaf = leafNodeIds[0]!;
      const { components: before } = getSnapshot(store);
      const originalParent = before[leaf]!.parentId;

      vi.advanceTimersByTime(HISTORY_COALESCE_MS + 1);
      store.getState().setParent(leaf, null);
      expect(getSnapshot(store).components[leaf]!.parentId).toBeNull();

      store.getState().undo();
      expect(getSnapshot(store).components[leaf]!.parentId).toBe(originalParent);
    });

    it("undo/redo preserves all 500 component positions", () => {
      const { store, allComponentIds } = seedStressDiagram();
      const { nodeLayouts: layoutsBefore } = getSnapshot(store);

      const positionsBefore = new Map(
        allComponentIds.map((id) => [id, { x: layoutsBefore[id]!.x, y: layoutsBefore[id]!.y }]),
      );

      vi.advanceTimersByTime(HISTORY_COALESCE_MS + 1);
      store.getState().commitNodeDrag(allComponentIds[0]!, null, { x: 9999, y: 9999 });

      store.getState().undo();

      const { nodeLayouts: layoutsAfter } = getSnapshot(store);
      for (const id of allComponentIds) {
        const expected = positionsBefore.get(id)!;
        expect(layoutsAfter[id]!.x).toBe(expected.x);
        expect(layoutsAfter[id]!.y).toBe(expected.y);
      }
    });

    it("undo on 500-element diagram completes in under 200ms", () => {
      const { store, leafNodeIds } = seedStressDiagram();
      vi.advanceTimersByTime(HISTORY_COALESCE_MS + 1);
      store.getState().setParent(leafNodeIds[0]!, null);

      const ms = measureMs(() => {
        store.getState().undo();
      });
      expect(ms).toBeLessThan(200);
    });
  });

  describe("remove & group", () => {
    it("removing a mid-level panel cascades to all descendants", () => {
      const { store, panelsByLevel } = seedStressDiagram();
      const { components: before } = getSnapshot(store);
      const midPanel = panelsByLevel[2]![0]!;

      const childrenIndex = buildChildrenIndex(before);
      const descendants = getDescendantIdsFromIndex(midPanel, childrenIndex);
      const countBefore = Object.keys(before).length;

      store.getState().removeComponent(midPanel);

      const { components: after } = getSnapshot(store);
      const countAfter = Object.keys(after).length;
      expect(countAfter).toBe(countBefore - descendants.size - 1);
      expect(after[midPanel]).toBeUndefined();
      for (const descId of descendants) {
        expect(after[descId]).toBeUndefined();
      }
    });

    it("groupNodes wraps multiple root elements into a new panel", () => {
      const { store, allComponentIds } = seedStressDiagram();
      const { components } = getSnapshot(store);
      const rootLeaves = allComponentIds.filter(
        (id) => components[id]!.parentId === null && !isPanelComponent(components[id]!),
      );

      expect(rootLeaves.length).toBeGreaterThanOrEqual(2);

      const panelId = store.getState().groupNodes(rootLeaves.slice(0, 5));
      expect(panelId).not.toBeNull();

      const { components: after } = getSnapshot(store);
      for (const id of rootLeaves.slice(0, 5)) {
        expect(after[id]!.parentId).toBe(panelId);
      }
    });

    it("ungroupNodes dissolves a panel and restores children to absolute positions", () => {
      const { store, panelsByLevel } = seedStressDiagram();
      const panel = panelsByLevel[0]![0]!;
      const { components: before, nodeLayouts: layoutsBefore } = getSnapshot(store);

      const childrenBefore = Object.values(before).filter((c) => c.parentId === panel);
      expect(childrenBefore.length).toBeGreaterThan(0);

      const panelLayout = layoutsBefore[panel]!;
      const absolutePositions = new Map(
        childrenBefore.map((c) => [
          c.id,
          {
            x: layoutsBefore[c.id]!.x + panelLayout.x,
            y: layoutsBefore[c.id]!.y + panelLayout.y,
          },
        ]),
      );

      store.getState().ungroupNodes(panel);

      const { components: after, nodeLayouts: layoutsAfter } = getSnapshot(store);
      expect(after[panel]).toBeUndefined();
      for (const child of childrenBefore) {
        expect(after[child.id]!.parentId).toBeNull();
        const expected = absolutePositions.get(child.id)!;
        expect(layoutsAfter[child.id]!.x).toBe(expected.x);
        expect(layoutsAfter[child.id]!.y).toBe(expected.y);
      }
    });
  });

  describe("performance (real timers)", () => {
    it("seeds 500 elements within acceptable time", () => {
      const ms = measureMs(() => {
        seedStressDiagram({ targetCount: 500 });
      });
      expect(ms).toBeLessThan(30_000);
    });

    it("setParent on 500-element diagram completes in under 100ms", () => {
      const { store, leafNodeIds } = seedStressDiagram();
      const ms = measureMs(() => {
        store.getState().setParent(leafNodeIds[0]!, null);
      });
      expect(ms).toBeLessThan(100);
    });

    it("commitNodeDrag on 500-element diagram completes in under 100ms", () => {
      const { store, leafNodeIds, panelsByLevel } = seedStressDiagram();
      const ms = measureMs(() => {
        store.getState().commitNodeDrag(leafNodeIds[0]!, panelsByLevel[0]![0]!, { x: 100, y: 100 });
      });
      expect(ms).toBeLessThan(100);
    });

    it("batchCommitNodeDrag with 20 entries completes in under 150ms", () => {
      const { store, leafNodeIds, panelsByLevel } = seedStressDiagram();
      const entries = leafNodeIds.slice(0, 20).map((id, i) => ({
        nodeId: id,
        newParentId: panelsByLevel[0]![i % panelsByLevel[0]!.length]!,
        newPosition: { x: i * 30, y: 20 },
      }));
      const ms = measureMs(() => {
        store.getState().batchCommitNodeDrag(entries);
      });
      expect(ms).toBeLessThan(150);
    });

    it("removeComponent with cascading descendants completes in under 300ms", () => {
      const { store, panelsByLevel } = seedStressDiagram();
      const ms = measureMs(() => {
        store.getState().removeComponent(panelsByLevel[0]![0]!);
      });
      expect(ms).toBeLessThan(300);
    });
  });
});
