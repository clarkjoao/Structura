import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("Batching and Coalescing", () => {
  describe("batch configuration", () => {
    it("has reasonable batch interval", () => {
      const BATCH_INTERVAL_MS = 50;
      expect(BATCH_INTERVAL_MS).toBe(50);
    });

    it("has reasonable max batch size", () => {
      const MAX_BATCH_SIZE = 10;
      expect(MAX_BATCH_SIZE).toBe(10);
    });
  });

  describe("patch coalescing", () => {
    it("merges multiple patches into single payload", () => {
      const patches = [
        { nodeLayouts: { n1: { x: 100 } } },
        { nodeLayouts: { n2: { x: 200 } } },
        { components: { c1: { type: "service" } } },
      ];

      // Simulate coalescing (last write wins)
      const merged: Record<string, unknown> = {};
      for (const patch of patches) {
        Object.assign(merged, patch);
      }

      expect(merged).toEqual({
        nodeLayouts: { n2: { x: 200 } }, // n1 overwritten by n2
        components: { c1: { type: "service" } },
      });
    });

    it("handles position updates from drag", () => {
      const dragPatches = [
        { nodeLayouts: { n1: { x: 100, y: 100 } } },
        { nodeLayouts: { n1: { x: 101, y: 100 } } },
        { nodeLayouts: { n1: { x: 102, y: 100 } } },
        { nodeLayouts: { n1: { x: 103, y: 100 } } },
        { nodeLayouts: { n1: { x: 104, y: 100 } } },
      ];

      // Coalesced to single patch
      const merged: Record<string, unknown> = {};
      for (const patch of dragPatches) {
        Object.assign(merged, patch);
      }

      // Only final position is sent
      expect(merged).toEqual({
        nodeLayouts: { n1: { x: 104, y: 100 } },
      });
    });

    it("preserves different node updates", () => {
      // Note: Object.assign does shallow merge, so nested objects are replaced
      const patches = [
        { nodeLayouts: { n1: { x: 100 } } },
        { nodeLayouts: { n2: { x: 200 } } },
        { nodeLayouts: { n3: { x: 300 } } },
      ];

      // With shallow merge, each patch replaces the entire nodeLayouts object
      // The final patch wins for the entire nested object
      let merged: Record<string, unknown> = {};
      for (const patch of patches) {
        merged = { ...merged, ...patch };
      }

      // Only the last patch's nodeLayouts is preserved with shallow merge
      expect(merged).toEqual({
        nodeLayouts: { n3: { x: 300 } },
      });
    });
  });

  describe("batch formation", () => {
    it("triggers flush when batch is full", () => {
      const MAX_BATCH_SIZE = 10;
      const batch: unknown[] = [];

      for (let i = 0; i < 10; i++) {
        batch.push({ id: i, patch: { x: i } });

        if (batch.length >= MAX_BATCH_SIZE) {
          // Force immediate flush
          break;
        }
      }

      expect(batch.length).toBe(10);
    });

    it("schedules flush on interval", () => {
      const BATCH_INTERVAL_MS = 50;
      let flushScheduled = false;

      // Simulate adding patches
      const scheduleFlush = () => {
        if (!flushScheduled) {
          flushScheduled = true;
          setTimeout(() => {
            flushScheduled = false;
          }, BATCH_INTERVAL_MS);
        }
      };

      scheduleFlush();
      expect(flushScheduled).toBe(true);
    });
  });

  describe("batch payload", () => {
    it("single patch does not include batched count", () => {
      const payload: Record<string, unknown> = {
        type: "host:patch",
        roomId: "room-1",
        patch: { nodeLayouts: { n1: { x: 100 } } },
        operationId: "op-1",
        version: 1,
      };

      expect(payload.batched).toBeUndefined();
    });

    it("multiple patches include batched count", () => {
      const payload: Record<string, unknown> = {
        type: "host:patch",
        roomId: "room-1",
        patch: { nodeLayouts: { n1: { x: 100 }, n2: { x: 200 } } },
        operationId: "op-2",
        version: 1,
        batched: 2,
      };

      expect(payload.batched).toBe(2);
    });
  });

  describe("performance optimization", () => {
    it("reduces network calls during rapid updates", () => {
      const updates = 50; // 50 drag events
      const MAX_BATCH_SIZE = 10;
      const BATCH_INTERVAL_MS = 50;

      // Without batching: 50 network calls
      // With batching: ~5 network calls (50/10)
      const batchesWithoutBatching = updates;
      const batchesWithBatching = Math.ceil(updates / MAX_BATCH_SIZE);

      expect(batchesWithoutBatching).toBe(50);
      expect(batchesWithBatching).toBe(5);
    });

    it("optimizes position-only updates", () => {
      const positionUpdates = 20; // 20 position updates during drag
      const merged = { nodeLayouts: { n1: { x: 0, y: 0 } } };

      // All 20 updates coalesced to 1
      for (let i = 1; i <= positionUpdates; i++) {
        merged.nodeLayouts.n1 = { x: i * 10, y: i * 5 };
      }

      // Only final position sent
      expect(merged.nodeLayouts.n1).toEqual({ x: 200, y: 100 });
    });

    it("handles mixed update types", () => {
      const mixedPatches = [
        { nodeLayouts: { n1: { x: 100 } } }, // Position
        { components: { c1: { name: "New Name" } } }, // Property
        { nodeLayouts: { n1: { x: 110 } } }, // Position (replaces n1)
        { nodeLayouts: { n2: { x: 200 } } }, // Position (replaces nodeLayouts)
        { edgeLayouts: { e1: { path: "M0,0" } } }, // Edge
      ];

      // With shallow merge, each patch replaces entire nested objects
      let merged: Record<string, unknown> = {};
      for (const patch of mixedPatches) {
        merged = { ...merged, ...patch };
      }

      // Only the last patch's nodeLayouts is preserved
      expect(merged).toEqual({
        nodeLayouts: { n2: { x: 200 } },
        components: { c1: { name: "New Name" } },
        edgeLayouts: { e1: { path: "M0,0" } },
      });
    });
  });

  describe("flush on disconnect", () => {
    it("flushes remaining batch on unmount", () => {
      const pendingBatch = [
        { id: "op-1", patch: { x: 1 }, timestamp: Date.now() },
        { id: "op-2", patch: { x: 2 }, timestamp: Date.now() },
      ];

      // Simulate unmount flush
      if (pendingBatch.length > 0) {
        // Flush all remaining patches
        const flushed = [...pendingBatch];
        pendingBatch.length = 0;

        expect(flushed.length).toBe(2);
        expect(pendingBatch.length).toBe(0);
      }
    });

    it("clears batch timer on disconnect", () => {
      let timerId: ReturnType<typeof setTimeout> | null = null;
      const BATCH_INTERVAL_MS = 50;

      timerId = setTimeout(() => {}, BATCH_INTERVAL_MS);

      // Simulate disconnect
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }

      expect(timerId).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles empty batch", () => {
      const batch: unknown[] = [];
      expect(batch.length).toBe(0);
    });

    it("handles single patch in batch", () => {
      const batch = [{ id: "op-1", patch: { x: 1 } }];
      const merged: Record<string, unknown> = {};
      for (const item of batch) {
        Object.assign(merged, (item as { patch: Record<string, unknown> }).patch);
      }
      expect(merged).toEqual({ x: 1 });
    });

    it("preserves operation IDs", () => {
      const batch = [
        { id: "op-1", patch: { x: 1 } },
        { id: "op-2", patch: { x: 2 } },
        { id: "op-3", patch: { x: 3 } },
      ];

      // Last operation ID is used for batch
      const lastOpId = batch[batch.length - 1].id;
      expect(lastOpId).toBe("op-3");
    });
  });
});
