import { afterEach, describe, expect, it } from "vitest";
import { makeState } from "./store/__fixtures__/merge.fixtures.js";
import { storeFactories } from "./store/testFactories.js";
import {
  FakeClient,
  hostRoom,
  joinRoom,
  makeRelay,
  patch,
  receivedSnapshot,
  user,
} from "./testing/harness.js";

/**
 * The connection's interaction, kind and direction are plain fields of a connection record, so the
 * relay's per-field diff carries them in the snapshot and in patches with no change to the
 * protocol. Two participants on one live room: what one writes, the other — and a late joiner —
 * reads.
 */

const SEED = makeState(
  {
    components: { a: { id: "a", name: "Checkout" }, b: { id: "b", name: "Ledger" } },
    connections: {
      c: {
        id: "c",
        sourceId: "a",
        targetId: "b",
        label: "charges",
        technology: "gRPC",
        interaction: "sync",
        kind: "call",
        direction: "unidirectional",
      },
      old: { id: "old", sourceId: "a", targetId: "b", label: "legacy", intent: "event" },
    },
  },
  { diagramId: "d1", diagramName: "Payments", level: "container" },
);

let roomCounter = 0;
const nextRoomId = () => `semantics-${process.pid}-${Date.now()}-${++roomCounter}`;

for (const factory of storeFactories()) {
  describe(`connection semantics over a live room — ${factory.name}`, () => {
    const cleanup: Array<() => Promise<void>> = [];
    afterEach(async () => {
      for (const fn of cleanup.splice(0)) await fn();
    });
    const setup = async () => {
      const store = await factory.make();
      const relay = makeRelay(store);
      cleanup.push(async () => {
        await relay.stop();
        await store.close();
      });
      return relay;
    };

    it("the seed's interaction, kind and direction reach a guest in the snapshot", async () => {
      const relay = await setup();
      const roomId = nextRoomId();
      await hostRoom(relay, roomId, SEED);
      const guest = new FakeClient(user("guest"));
      await joinRoom(relay, roomId, guest);
      const state = await receivedSnapshot(guest);
      expect(state.entities.connections.c).toMatchObject({
        interaction: "sync",
        kind: "call",
        direction: "unidirectional",
        technology: "gRPC",
      });
    });

    it("a change of interaction and kind is sent to the other participant as a patch", async () => {
      const relay = await setup();
      const roomId = nextRoomId();
      const { host } = await hostRoom(relay, roomId, SEED);
      const guest = new FakeClient(user("guest"));
      await joinRoom(relay, roomId, guest);
      await receivedSnapshot(guest);

      const change = {
        entities: { connections: { c: { set: { interaction: "async", kind: "event" } } } },
      };
      const opId = patch(guest, change, 0);
      await guest.next("ack", (a) => a.opId === opId);
      expect(await host.next("entry", (e) => e.opId === opId)).toMatchObject({ patch: change });
    });

    it("swapping the direction travels as the two ends changing, and a late joiner sees it", async () => {
      const relay = await setup();
      const roomId = nextRoomId();
      const { host } = await hostRoom(relay, roomId, SEED);
      const swap = {
        entities: { connections: { c: { set: { sourceId: "b", targetId: "a" } } } },
      };
      const opId = patch(host, swap, 0);
      await host.next("ack", (a) => a.opId === opId);

      const late = new FakeClient(user("late"));
      await joinRoom(relay, roomId, late);
      const state = await receivedSnapshot(late);
      expect(state.entities.connections.c).toMatchObject({
        sourceId: "b",
        targetId: "a",
        interaction: "sync",
        kind: "call",
      });
    });

    it("clearing a retired field (intent) is an unset that reaches everyone", async () => {
      const relay = await setup();
      const roomId = nextRoomId();
      const { host } = await hostRoom(relay, roomId, SEED);
      const guest = new FakeClient(user("guest"));
      await joinRoom(relay, roomId, guest);
      await receivedSnapshot(guest);
      const clear = {
        entities: {
          connections: { old: { set: { interaction: "async", kind: "event" }, unset: ["intent"] } },
        },
      };
      const opId = patch(host, clear, 0);
      await host.next("ack", (a) => a.opId === opId);
      expect(await guest.next("entry", (e) => e.opId === opId)).toMatchObject({ patch: clear });
    });
  });
}
