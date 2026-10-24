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
 * A boundary's type is a field of its component record, and its domain and derived colours are
 * computed from the group it sits in — nothing about them is a doc field — so the relay carries
 * them in the snapshot and in patches as it carries any component field.
 */

const SEED = makeState(
  {
    components: {
      vendas: { id: "vendas", name: "Vendas", type: "panel", parentId: null },
      q: {
        id: "q",
        name: "Q-Checkout",
        type: "panel",
        parentId: "vendas",
        boundaryType: "quantum",
      },
    },
  },
  { diagramId: "d1", diagramName: "Sales", level: "container" },
);

let roomCounter = 0;
const nextRoomId = () => `boundary-${process.pid}-${Date.now()}-${++roomCounter}`;

for (const factory of storeFactories()) {
  describe(`boundary fields over a live room — ${factory.name}`, () => {
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

    it("the boundary type and its group reach a guest in the snapshot", async () => {
      const relay = await setup();
      const roomId = nextRoomId();
      await hostRoom(relay, roomId, SEED);
      const guest = new FakeClient(user("guest"));
      await joinRoom(relay, roomId, guest);
      const state = await receivedSnapshot(guest);
      expect(state.entities.components.q).toMatchObject({
        boundaryType: "quantum",
        parentId: "vendas",
      });
    });

    it("changing the type, and then clearing it, reaches the other participant", async () => {
      const relay = await setup();
      const roomId = nextRoomId();
      const { host } = await hostRoom(relay, roomId, SEED);
      const guest = new FakeClient(user("guest"));
      await joinRoom(relay, roomId, guest);
      await receivedSnapshot(guest);

      const retype = { entities: { components: { q: { set: { boundaryType: "network" } } } } };
      const first = patch(guest, retype, 0);
      await guest.next("ack", (a) => a.opId === first);
      expect(await host.next("entry", (e) => e.opId === first)).toMatchObject({ patch: retype });

      const clear = { entities: { components: { q: { unset: ["boundaryType"] } } } };
      const second = patch(host, clear, 1);
      await host.next("ack", (a) => a.opId === second);
      expect(await guest.next("entry", (e) => e.opId === second)).toMatchObject({ patch: clear });
    });
  });
}
