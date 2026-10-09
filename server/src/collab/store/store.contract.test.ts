import { afterEach, describe, expect, it } from "vitest";
import { chunkString, type DiagramState, type Participant } from "../protocol.js";
import { MERGE_FIXTURES, makeState } from "./__fixtures__/merge.fixtures.js";
import { MemoryRoomStore } from "./memory.js";
import type { RoomEvent, RoomStore } from "./types.js";
import { storeFactories } from "./testFactories.js";

/**
 * The contract every RoomStore implementation must meet. The memory store is the reference;
 * the Redis store runs the same suite when REDIS_URL is set.
 */

const HOST = { id: "host", name: "Host", color: "#000" };

async function openRoom(store: RoomStore, roomId: string, seed: DiagramState): Promise<void> {
  const chunks = chunkString(JSON.stringify(seed), 50);
  expect(
    await store.createRoom({
      roomId,
      hostTokenHash: "hash",
      hostUser: HOST,
      seedChunks: chunks.length,
      now: Date.now(),
    }),
  ).toBe("created");
  for (const [index, data] of chunks.entries()) await store.appendSeedChunk(roomId, index, data);
  expect(await store.commitSeed(roomId)).toEqual({ ok: true });
}

let roomCounter = 0;
const nextRoomId = () => `room-${process.pid}-${Date.now()}-${++roomCounter}`;

for (const factory of storeFactories()) {
  describe(`RoomStore contract — ${factory.name}`, () => {
    const stores: RoomStore[] = [];
    const make = async () => {
      const store = await factory.make();
      stores.push(store);
      return store;
    };
    afterEach(async () => {
      for (const store of stores.splice(0)) await store.close();
    });

    describe("merge fixtures", () => {
      for (const fixture of MERGE_FIXTURES) {
        it(fixture.name, async () => {
          const store = await make();
          const roomId = nextRoomId();
          await openRoom(store, roomId, fixture.seed);
          for (const lock of fixture.locks ?? []) {
            expect(
              (await store.acquireLock(roomId, lock.entityId, lock.holder, 60_000)).granted,
            ).toBe(true);
          }
          let version = 0;
          for (const [index, step] of fixture.steps.entries()) {
            const result = await store.applyPatch(roomId, {
              patch: step.patch,
              senderVersion: step.senderVersion ?? version,
              senderId: step.sender,
              opId: `op-${index}`,
            });
            expect(result.status, `step ${index}`).toBe(step.expect);
            if (result.status === "applied") {
              version = result.version;
              if (step.effective) expect(result.effective).toEqual(step.effective);
            }
          }
          const snapshot = await store.readSnapshot(roomId);
          expect(snapshot?.version).toBe(fixture.finalVersion);
          expect(snapshot?.state).toEqual(fixture.finalState);
        });
      }
    });

    it("refuses a second room with the same id", async () => {
      const store = await make();
      const roomId = nextRoomId();
      await openRoom(store, roomId, makeState());
      expect(
        await store.createRoom({
          roomId,
          hostTokenHash: "x",
          hostUser: HOST,
          seedChunks: 1,
          now: Date.now(),
        }),
      ).toBe("exists");
    });

    it("keeps a room in seeding until the commit, and serves no state", async () => {
      const store = await make();
      const roomId = nextRoomId();
      await store.createRoom({ roomId, hostTokenHash: "h", hostUser: HOST, seedChunks: 2, now: 0 });
      await store.appendSeedChunk(roomId, 0, '{"doc":{},');
      expect((await store.getMeta(roomId))?.status).toBe("seeding");
      expect(await store.readSnapshot(roomId)).toBeNull();
      expect(
        (
          await store.applyPatch(roomId, {
            patch: { doc: { diagramName: "x" } },
            senderVersion: 0,
            senderId: "a",
            opId: "o",
          })
        ).status,
      ).toBe("not_open");
    });

    it("rejects an incomplete or malformed seed", async () => {
      const store = await make();
      const missing = nextRoomId();
      await store.createRoom({
        roomId: missing,
        hostTokenHash: "h",
        hostUser: HOST,
        seedChunks: 2,
        now: 0,
      });
      await store.appendSeedChunk(missing, 0, "{}");
      expect(await store.commitSeed(missing)).toEqual({ ok: false, code: "invalid_seed" });

      const malformed = nextRoomId();
      await store.createRoom({
        roomId: malformed,
        hostTokenHash: "h",
        hostUser: HOST,
        seedChunks: 1,
        now: 0,
      });
      await store.appendSeedChunk(malformed, 0, '{"doc":{},"entities":{"__proto__":{}}}');
      expect(await store.commitSeed(malformed)).toEqual({ ok: false, code: "invalid_seed" });
    });

    it("forgets a discarded room", async () => {
      const store = await make();
      const roomId = nextRoomId();
      await store.createRoom({ roomId, hostTokenHash: "h", hostUser: HOST, seedChunks: 1, now: 0 });
      await store.discardRoom(roomId);
      expect(await store.getMeta(roomId)).toBeNull();
    });

    it("reads a seed back exactly, across many chunks", async () => {
      const store = await make();
      const roomId = nextRoomId();
      const components: Record<string, Record<string, unknown>> = {};
      for (let i = 0; i < 300; i++) components[`c${i}`] = { id: `c${i}`, name: `Service ${i} — ✓` };
      const seed = makeState({ components }, { diagramId: "d", diagramName: "Big" });
      await openRoom(store, roomId, seed);
      expect((await store.readSnapshot(roomId))?.state).toEqual(seed);
    });

    it("replays exactly the entries after a version, and refuses what it no longer holds", async () => {
      const store = await make();
      const roomId = nextRoomId();
      await openRoom(store, roomId, makeState());
      for (let i = 1; i <= 5; i++) {
        await store.applyPatch(roomId, {
          patch: { doc: { diagramName: `n${i}` } },
          senderVersion: i - 1,
          senderId: "a",
          opId: `o${i}`,
        });
      }
      expect((await store.readEntries(roomId, 2))?.map((e) => e.version)).toEqual([3, 4, 5]);
      expect(await store.readEntries(roomId, 5)).toEqual([]);
      expect(await store.readEntries(roomId, 6)).toBeNull();
      const entries = await store.readEntries(roomId, 4);
      expect(entries?.[0]).toEqual({
        version: 5,
        opId: "o5",
        sender: "a",
        patch: { doc: { diagramName: "n5" } },
      });
    });

    it("delivers entries in version order to every subscriber", async () => {
      const store = await make();
      const roomId = nextRoomId();
      await openRoom(store, roomId, makeState());
      const seen: number[][] = [[], []];
      const unsubs = await Promise.all(
        seen.map((list) =>
          store.subscribe(roomId, (event: RoomEvent) => {
            if (event.kind === "entry") list.push(event.entry.version);
          }),
        ),
      );
      await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          store.applyPatch(roomId, {
            patch: { entities: { nodeLayouts: { n: { set: { x: i } } } } },
            senderVersion: 0,
            senderId: `p${i % 3}`,
            opId: `o${i}`,
          }),
        ),
      );
      await factory.settle();
      const expected = Array.from({ length: 20 }, (_, i) => i + 1);
      expect(seen[0]).toEqual(expected);
      expect(seen[1]).toEqual(expected);
      for (const unsub of unsubs) unsub();
    });

    it("closes once and tells subscribers why", async () => {
      const store = await make();
      const roomId = nextRoomId();
      await openRoom(store, roomId, makeState());
      const events: RoomEvent[] = [];
      const unsub = await store.subscribe(roomId, (event) => events.push(event));
      const results = await Promise.all([
        store.closeRoom(roomId, "host_timeout"),
        store.closeRoom(roomId, "host_timeout"),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
      await factory.settle();
      expect(events).toEqual([{ kind: "closed", reason: "host_timeout" }]);
      expect((await store.getMeta(roomId))?.status).toBe("closed");
      unsub();
    });

    it("enforces capacity and lets a member's own reconnect replace it", async () => {
      const store = await make();
      const roomId = nextRoomId();
      await openRoom(store, roomId, makeState());
      const member = (id: string): Participant => ({
        clientId: id,
        user: { id, name: id, color: "#111" },
        role: "guest",
      });
      const now = Date.now();
      expect(await store.addMember(roomId, member("a"), "s1", now + 30_000, 2, now)).toEqual({
        ok: true,
        count: 1,
      });
      expect(await store.addMember(roomId, member("b"), "s2", now + 30_000, 2, now)).toEqual({
        ok: true,
        count: 2,
      });
      expect(await store.addMember(roomId, member("c"), "s3", now + 30_000, 2, now)).toEqual({
        ok: false,
        reason: "full",
      });
      // Reconnect of "a" on a new socket: not counted twice.
      expect(await store.addMember(roomId, member("a"), "s4", now + 30_000, 2, now)).toEqual({
        ok: true,
        count: 2,
      });
      // The stale socket's removal must not evict the replacement.
      expect(await store.removeMember(roomId, "a", "s1", now)).toBe(2);
      expect(await store.removeMember(roomId, "a", "s4", now)).toBe(1);
      expect((await store.listMembers(roomId, now)).map((m) => m.clientId)).toEqual(["b"]);
    });

    it("expires members whose relay stopped renewing them", async () => {
      const store = await make();
      const roomId = nextRoomId();
      await openRoom(store, roomId, makeState());
      const now = Date.now();
      await store.addMember(
        roomId,
        { clientId: "a", user: { id: "a", name: "a", color: "#1" }, role: "guest" },
        "s1",
        now + 1_000,
        50,
        now,
      );
      expect(await store.listMembers(roomId, now)).toHaveLength(1);
      expect(await store.listMembers(roomId, now + 2_000)).toHaveLength(0);
    });

    it("grants a lock to one holder, renews it, and releases only for the holder", async () => {
      const store = await make();
      const roomId = nextRoomId();
      await openRoom(store, roomId, makeState());
      expect(await store.acquireLock(roomId, "n1", "a", 10_000)).toEqual({
        granted: true,
        holder: "a",
      });
      expect(await store.acquireLock(roomId, "n1", "b", 10_000)).toEqual({
        granted: false,
        holder: "a",
      });
      expect(await store.acquireLock(roomId, "n1", "a", 10_000)).toEqual({
        granted: true,
        holder: "a",
      });
      expect(await store.releaseLock(roomId, "n1", "b")).toBe(false);
      expect(await store.releaseLock(roomId, "n1", "a")).toBe(true);
      expect(await store.acquireLock(roomId, "n1", "b", 10_000)).toEqual({
        granted: true,
        holder: "b",
      });
    });

    it("lets a lock lapse after its ttl", async () => {
      const store = await make();
      const roomId = nextRoomId();
      await openRoom(store, roomId, makeState());
      await store.acquireLock(roomId, "n1", "a", 50);
      await new Promise((resolve) => setTimeout(resolve, 120));
      expect(await store.acquireLock(roomId, "n1", "b", 1_000)).toEqual({
        granted: true,
        holder: "b",
      });
    });

    it("tracks host leases and flips host status once", async () => {
      const store = await make();
      const roomId = nextRoomId();
      await openRoom(store, roomId, makeState());
      const t = Date.now();
      await store.renewHostLease(roomId, t + 5_000);
      expect(await store.expiredHostLeases(t)).not.toContain(roomId);
      expect(await store.expiredHostLeases(t + 6_000)).toContain(roomId);
      expect(await store.markHostOffline(roomId)).toBe(true);
      expect(await store.markHostOffline(roomId)).toBe(false);
      expect(await store.isHostOnline(roomId)).toBe(false);
      await store.markHostOnline(roomId);
      expect(await store.isHostOnline(roomId)).toBe(true);
    });

    it("fans presence out to every presence subscriber", async () => {
      const store = await make();
      const roomId = nextRoomId();
      await openRoom(store, roomId, makeState());
      const got: string[] = [];
      const unsub = await store.subscribePresence(roomId, (event) => got.push(event.kind));
      await store.publishPresence(roomId, { kind: "host:status", online: false });
      await factory.settle();
      expect(got).toEqual(["host:status"]);
      unsub();
    });
  });
}

// The reference store is always exercised, even when no factory list is configured.
it("the memory store is part of the contract run", () => {
  expect(storeFactories().some((f) => f.name === "memory")).toBe(true);
  expect(new MemoryRoomStore().kind).toBe("memory");
});
