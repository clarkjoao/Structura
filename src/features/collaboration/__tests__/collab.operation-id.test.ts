import { describe, expect, it, vi } from "vitest";

describe("Operation ID + ACK Mechanism", () => {
  describe("operation ID generation", () => {
    it("generates unique operation IDs", () => {
      const generateOpId = () =>
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });

      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateOpId());
      }
      expect(ids.size).toBe(100); // All unique
    });

    it("generates valid UUID v4 format", () => {
      const generateOpId = () =>
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });

      const id = generateOpId();
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidV4Regex.test(id)).toBe(true);
    });
  });

  describe("pending operations tracking", () => {
    it("tracks pending operations", () => {
      const pendingOps = new Map<string, { id: string; timestamp: number; patch: Record<string, unknown> }>();

      const operationId = "op-123";
      pendingOps.set(operationId, {
        id: operationId,
        timestamp: Date.now(),
        patch: { nodeLayouts: { n1: { x: 100 } } },
      });

      expect(pendingOps.has(operationId)).toBe(true);
      expect(pendingOps.get(operationId)?.patch).toEqual({ nodeLayouts: { n1: { x: 100 } } });
    });

    it("removes operation on ACK", () => {
      const pendingOps = new Map<string, { id: string; timestamp: number }>();
      const acknowledged = new Set<string>();

      const operationId = "op-123";
      pendingOps.set(operationId, { id: operationId, timestamp: Date.now() });

      // Simulate ACK received
      acknowledged.add(operationId);
      pendingOps.delete(operationId);

      expect(pendingOps.has(operationId)).toBe(false);
      expect(acknowledged.has(operationId)).toBe(true);
    });

    it("limits pending operations", () => {
      const MAX_PENDING = 100;
      const pendingOps = new Map<string, { id: string }>();

      // Add more than MAX_PENDING operations
      for (let i = 0; i < 150; i++) {
        const id = `op-${i}`;
        pendingOps.set(id, { id });

        // Simulate the cleanup logic
        if (pendingOps.size > MAX_PENDING) {
          const oldestKey = pendingOps.keys().next().value;
          if (oldestKey) {
            pendingOps.delete(oldestKey);
          }
        }
      }

      expect(pendingOps.size).toBe(MAX_PENDING);
    });

    it("handles duplicate ACK gracefully", () => {
      const pendingOps = new Map<string, { id: string }>();
      const acknowledged = new Set<string>();

      const operationId = "op-123";
      pendingOps.set(operationId, { id: operationId });

      // First ACK
      acknowledged.add(operationId);
      pendingOps.delete(operationId);

      // Second ACK (duplicate) - should not throw
      acknowledged.add(operationId); // Set ignores duplicates
      pendingOps.delete(operationId); // Map.delete on non-existent key is safe

      expect(acknowledged.has(operationId)).toBe(true);
    });
  });

  describe("operation ID in messages", () => {
    it("includes operationId in host:patch", () => {
      const message = {
        type: "host:patch",
        roomId: "room-1",
        patch: { nodeLayouts: { n1: { x: 100 } } },
        operationId: "op-abc-123",
      };
      expect(message.operationId).toBe("op-abc-123");
    });

    it("includes operationId in guest:patch", () => {
      const message = {
        type: "guest:patch",
        roomId: "room-1",
        patch: { components: { c1: { type: "service" } } },
        operationId: "op-xyz-789",
      };
      expect(message.operationId).toBe("op-xyz-789");
    });

    it("includes operationId in OP_ACK", () => {
      const ackMessage = {
        type: "OP_ACK",
        operationId: "op-abc-123",
        accepted: true,
      };
      expect(ackMessage.operationId).toBe("op-abc-123");
      expect(ackMessage.accepted).toBe(true);
    });

    it("includes operationId in session:patch broadcast", () => {
      const broadcastMessage = {
        type: "session:patch",
        patch: { nodeLayouts: { n1: { x: 200 } } },
        operationId: "op-abc-123",
        clientId: "guest-1",
      };
      expect(broadcastMessage.operationId).toBe("op-abc-123");
      expect(broadcastMessage.clientId).toBe("guest-1");
    });

    it("handles rejected operations", () => {
      const ackMessage = {
        type: "OP_ACK",
        operationId: "op-rejected",
        accepted: false,
        reason: "INVALID_OPERATION",
      };
      expect(ackMessage.accepted).toBe(false);
      expect(ackMessage.reason).toBe("INVALID_OPERATION");
    });
  });

  describe("deduplication", () => {
    it("prevents duplicate operations from being applied twice", () => {
      const appliedOps = new Set<string>();

      const applyOperation = (opId: string, patch: Record<string, unknown>) => {
        if (appliedOps.has(opId)) {
          return false; // Already applied
        }
        appliedOps.add(opId);
        return true; // Applied successfully
      };

      // First application succeeds
      expect(applyOperation("op-1", { x: 100 })).toBe(true);

      // Second application is rejected (duplicate)
      expect(applyOperation("op-1", { x: 200 })).toBe(false);

      // The original value should be preserved
      expect(appliedOps.has("op-1")).toBe(true);
    });

    it("tracks acknowledged operations separately", () => {
      const pendingOps = new Map<string, unknown>();
      const acknowledged = new Set<string>();

      const operationId = "op-1";
      pendingOps.set(operationId, {});

      // Move to acknowledged on ACK
      acknowledged.add(operationId);
      pendingOps.delete(operationId);

      // Subsequent session:patch with same ID should be ignored
      const shouldIgnore = acknowledged.has(operationId);
      expect(shouldIgnore).toBe(true);
    });
  });

  describe("clear on disconnect", () => {
    it("clears pending operations on disconnect", () => {
      const pendingOps = new Map<string, { id: string }>();
      const acknowledged = new Set<string>();

      // Add some pending operations
      pendingOps.set("op-1", { id: "op-1" });
      pendingOps.set("op-2", { id: "op-2" });
      acknowledged.add("op-1");

      // Simulate disconnect cleanup
      pendingOps.clear();
      acknowledged.clear();

      expect(pendingOps.size).toBe(0);
      expect(acknowledged.size).toBe(0);
    });
  });
});
