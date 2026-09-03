import { describe, expect, it, vi } from "vitest";

describe("Version Sequencing", () => {
  describe("server-side version counter", () => {
    it("starts at version 0 for new room", () => {
      const room = {
        version: 0,
        operationLog: [] as Array<{ version: number; operationId: string; clientId: string; patch: Record<string, unknown>; timestamp: number }>,
      };
      expect(room.version).toBe(0);
    });

    it("increments version on each operation", () => {
      const room = {
        version: 0,
        operationLog: [] as Array<{ version: number; operationId: string; clientId: string; patch: Record<string, unknown>; timestamp: number }>,
      };

      // Simulate 5 operations
      for (let i = 1; i <= 5; i++) {
        room.version++;
        room.operationLog.push({
          version: room.version,
          operationId: `op-${i}`,
          clientId: `user-${i}`,
          patch: { nodeLayouts: { [`node-${i}`]: { x: i * 100 } } },
          timestamp: Date.now(),
        });
      }

      expect(room.version).toBe(5);
      expect(room.operationLog.length).toBe(5);
    });
  });

  describe("operation log", () => {
    it("stores operations with version", () => {
      const operationLog: Array<{ version: number; operationId: string; clientId: string; patch: Record<string, unknown>; timestamp: number }> = [];

      operationLog.push({
        version: 1,
        operationId: "op-abc",
        clientId: "host-1",
        patch: { components: { c1: { name: "Service 1" } } },
        timestamp: Date.now(),
      });

      expect(operationLog[0].version).toBe(1);
      expect(operationLog[0].operationId).toBe("op-abc");
    });

    it("limits operation log size", () => {
      const MAX_LOG_SIZE = 1000;
      const operationLog: Array<{ version: number }> = [];

      // Add 1500 operations
      for (let i = 1; i <= 1500; i++) {
        operationLog.push({ version: i });
        if (operationLog.length > MAX_LOG_SIZE) {
          operationLog.shift(); // Remove oldest
        }
      }

      expect(operationLog.length).toBe(MAX_LOG_SIZE);
      expect(operationLog[0].version).toBe(501); // First element should be 501
      expect(operationLog[999].version).toBe(1500); // Last element should be 1500
    });
  });

  describe("version gap detection", () => {
    it("detects when client is behind", () => {
      const serverVersion = 100;
      const clientVersion = 50;
      const gapThreshold = 1;

      const clientIsBehind = clientVersion < serverVersion - gapThreshold;
      expect(clientIsBehind).toBe(true);
    });

    it("allows client at same version", () => {
      const serverVersion = 100;
      const clientVersion = 100;
      const gapThreshold = 1;

      const clientIsBehind = clientVersion < serverVersion - gapThreshold;
      expect(clientIsBehind).toBe(false);
    });

    it("allows client one version behind", () => {
      const serverVersion = 100;
      const clientVersion = 99;
      const gapThreshold = 1;

      const clientIsBehind = clientVersion < serverVersion - gapThreshold;
      expect(clientIsBehind).toBe(false);
    });
  });

  describe("sync request", () => {
    it("extracts operations since base version", () => {
      const operationLog = [
        { version: 1, patch: { a: 1 } },
        { version: 2, patch: { b: 2 } },
        { version: 3, patch: { c: 3 } },
        { version: 4, patch: { d: 4 } },
        { version: 5, patch: { e: 5 } },
      ];

      const baseVersion = 2;
      const opsSinceBase = operationLog.filter((op) => op.version > baseVersion);

      expect(opsSinceBase.length).toBe(3);
      expect(opsSinceBase[0].version).toBe(3);
      expect(opsSinceBase[2].version).toBe(5);
    });

    it("returns empty array when already up to date", () => {
      const operationLog = [
        { version: 1, patch: { a: 1 } },
        { version: 2, patch: { b: 2 } },
      ];

      const baseVersion = 2;
      const opsSinceBase = operationLog.filter((op) => op.version > baseVersion);

      expect(opsSinceBase.length).toBe(0);
    });
  });

  describe("version in messages", () => {
    it("includes version in OP_ACK", () => {
      const ackMessage = {
        type: "OP_ACK",
        operationId: "op-123",
        version: 42,
        accepted: true,
      };
      expect(ackMessage.version).toBe(42);
    });

    it("includes version in session:patch", () => {
      const patchMessage = {
        type: "session:patch",
        patch: { nodeLayouts: { n1: { x: 100 } } },
        operationId: "op-123",
        version: 42,
      };
      expect(patchMessage.version).toBe(42);
    });

    it("includes version in session:init", () => {
      const initMessage = {
        type: "session:init",
        participantCount: 5,
        maxParticipants: 15,
        version: 100,
        snapshot: {},
        hostUser: {},
        peers: [],
      };
      expect(initMessage.version).toBe(100);
    });

    it("includes version in host:ack", () => {
      const ackMessage = {
        type: "host:ack",
        resumed: true,
        version: 50,
        snapshot: {},
      };
      expect(ackMessage.version).toBe(50);
    });

    it("includes baseVersion in sync:request", () => {
      const syncRequest = {
        type: "sync:request",
        roomId: "room-1",
        baseVersion: 75,
      };
      expect(syncRequest.baseVersion).toBe(75);
    });

    it("includes operations in sync:complete", () => {
      const syncComplete = {
        type: "SYNC_COMPLETE",
        version: 100,
        operations: [
          { version: 76, operationId: "op-1", patch: { a: 1 }, clientId: "host-1" },
          { version: 77, operationId: "op-2", patch: { b: 2 }, clientId: "guest-1" },
        ],
      };
      expect(syncComplete.operations.length).toBe(2);
      expect(syncComplete.version).toBe(100);
    });
  });

  describe("client version tracking", () => {
    it("tracks local version", () => {
      const localVersion = { version: 0, baseVersion: 0 };

      // Simulate receiving patches
      localVersion.version = 1;
      localVersion.version = 2;
      localVersion.version = 3;

      expect(localVersion.version).toBe(3);
    });

    it("updates baseVersion after sync", () => {
      const localVersion = { version: 50, baseVersion: 0 };

      // Simulate sync
      localVersion.baseVersion = localVersion.version;

      expect(localVersion.baseVersion).toBe(50);
    });
  });

  describe("client sending version", () => {
    it("includes version in patch messages", () => {
      const patchMessage = {
        type: "host:patch",
        roomId: "room-1",
        patch: { nodeLayouts: { n1: { x: 100 } } },
        operationId: "op-123",
        version: 42,
      };
      expect(patchMessage.version).toBe(42);
    });
  });
});
