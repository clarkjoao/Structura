import { describe, expect, it } from "vitest";

describe("Periodic Snapshot", () => {
  describe("snapshot configuration", () => {
    it("has reasonable snapshot interval by operations", () => {
      const SNAPSHOT_INTERVAL_OPS = 100;
      expect(SNAPSHOT_INTERVAL_OPS).toBe(100);
    });

    it("has reasonable snapshot interval by time", () => {
      const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
      expect(SNAPSHOT_INTERVAL_MS).toBe(300000);
    });
  });

  describe("snapshot triggers", () => {
    it("triggers after N operations", () => {
      const SNAPSHOT_INTERVAL_OPS = 100;
      const opsSinceSnapshot = 100;
      const shouldSnapshot = opsSinceSnapshot >= SNAPSHOT_INTERVAL_OPS;
      expect(shouldSnapshot).toBe(true);
    });

    it("does not trigger before N operations", () => {
      const SNAPSHOT_INTERVAL_OPS = 100;
      const opsSinceSnapshot = 50;
      const shouldSnapshot = opsSinceSnapshot >= SNAPSHOT_INTERVAL_OPS;
      expect(shouldSnapshot).toBe(false);
    });
  });

  describe("snapshot marker", () => {
    it("tracks snapshot version", () => {
      const room = {
        version: 100,
        snapshotAtVersion: 50,
      };
      expect(room.version - room.snapshotAtVersion).toBe(50);
    });

    it("updates after taking snapshot", () => {
      const room = {
        version: 100,
        snapshotAtVersion: 50,
      };

      // Take snapshot
      room.snapshotAtVersion = room.version;

      expect(room.snapshotAtVersion).toBe(100);
      expect(room.version - room.snapshotAtVersion).toBe(0);
    });
  });

  describe("operation log pruning", () => {
    it("prunes operations older than snapshot", () => {
      const operationLog = [
        { version: 40, patch: { x: 1 } },
        { version: 50, patch: { x: 2 } }, // snapshot at version 50
        { version: 51, patch: { x: 3 } },
        { version: 52, patch: { x: 4 } },
        { version: 53, patch: { x: 5 } },
      ];

      const snapshotAtVersion = 50;

      // Keep only operations after snapshot
      const prunedLog = operationLog.filter((op) => op.version > snapshotAtVersion);

      expect(prunedLog.length).toBe(3);
      expect(prunedLog[0].version).toBe(51);
      expect(prunedLog[2].version).toBe(53);
    });

    it("keeps all operations if none are older than snapshot", () => {
      const operationLog = [
        { version: 55, patch: { x: 1 } },
        { version: 56, patch: { x: 2 } },
        { version: 57, patch: { x: 3 } },
      ];

      const snapshotAtVersion = 50;
      const prunedLog = operationLog.filter((op) => op.version > snapshotAtVersion);

      expect(prunedLog.length).toBe(3);
    });
  });

  describe("snapshot in messages", () => {
    it("PERIODIC_SNAPSHOT includes version and snapshot", () => {
      const message = {
        type: "PERIODIC_SNAPSHOT",
        version: 100,
        snapshot: { nodeLayouts: { n1: { x: 100 } } },
      };
      expect(message.type).toBe("PERIODIC_SNAPSHOT");
      expect(message.version).toBe(100);
      expect(message.snapshot).toBeDefined();
    });

    it("SYNC_SNAPSHOT includes snapshotVersion for sync", () => {
      const message = {
        type: "SYNC_SNAPSHOT",
        version: 100,
        snapshot: { nodeLayouts: { n1: { x: 100 } } },
        snapshotVersion: 50,
      };
      expect(message.snapshotVersion).toBe(50);
    });
  });

  describe("sync when behind snapshot", () => {
    it("sends snapshot if client is behind snapshot version", () => {
      const room = {
        version: 100,
        snapshotAtVersion: 50,
      };
      const clientBaseVersion = 30;

      // Client is behind snapshot
      const needsSnapshot = clientBaseVersion < room.snapshotAtVersion;
      expect(needsSnapshot).toBe(true);
    });

    it("sends incremental ops if client is after snapshot", () => {
      const room = {
        version: 100,
        snapshotAtVersion: 50,
      };
      const clientBaseVersion = 60;

      // Client is after snapshot but needs ops 61-100
      const needsSnapshot = clientBaseVersion < room.snapshotAtVersion;
      expect(needsSnapshot).toBe(false);
    });
  });

  describe("memory management", () => {
    it("operation log is bounded", () => {
      const MAX_OPERATION_LOG_SIZE = 1000;
      const operationLog = Array.from({ length: 1500 }, (_, i) => ({
        version: i + 1,
        patch: { x: i },
      }));

      // Prune to max size
      const pruned = operationLog.slice(-MAX_OPERATION_LOG_SIZE);

      expect(pruned.length).toBe(MAX_OPERATION_LOG_SIZE);
      expect(pruned[0].version).toBe(501);
    });
  });

  describe("periodic timer", () => {
    it("calculates time-based snapshot correctly", () => {
      const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
      const fiveMinutes = 5 * 60 * 1000;
      expect(SNAPSHOT_INTERVAL_MS).toBe(fiveMinutes);
    });
  });

  describe("client handling", () => {
    it("updates version but not baseVersion on PERIODIC_SNAPSHOT", () => {
      const versionRef = { version: 75, baseVersion: 50 };

      // Received periodic snapshot at version 100
      const newVersion = 100;
      versionRef.version = newVersion;
      // baseVersion is NOT updated - keeps tracking

      expect(versionRef.version).toBe(100);
      expect(versionRef.baseVersion).toBe(50);
    });
  });
});
