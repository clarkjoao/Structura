import { afterEach, describe, expect, it } from "vitest";
import { COLLAB_PROTOCOL_VERSION, LIMITS } from "./protocol.js";
import type { CollabRelay, RelayOptions } from "./relay.js";
import { makeState } from "./store/__fixtures__/merge.fixtures.js";
import { storeFactories } from "./store/testFactories.js";
import type { RoomStore } from "./store/types.js";
import {
  FakeClient,
  hostRoom,
  joinRoom,
  makeRelay,
  patch,
  receivedSnapshot,
  sleep,
  user,
} from "./testing/harness.js";

const SEED = makeState(
  {
    components: { c1: { id: "c1", name: "API" }, c2: { id: "c2", name: "DB" } },
    nodeLayouts: { c1: { elementId: "c1", x: 0, y: 0 }, c2: { elementId: "c2", x: 300, y: 0 } },
  },
  { diagramId: "d1", diagramName: "Payments", level: "context" },
);

/** Short lease and grace so lifecycle tests run in well under a second. */
const FAST: RelayOptions = {
  hostGraceMs: 400,
  hostLeaseMs: 100,
  hostLeaseRenewMs: 30,
  reaperIntervalMs: 20,
  cursorFlushMs: 20,
  roomCheckMs: 50,
};

let roomCounter = 0;
const nextRoomId = () => `relay-${process.pid}-${Date.now()}-${++roomCounter}`;

for (const factory of storeFactories()) {
  describe(`CollabRelay — ${factory.name}`, () => {
    const cleanup: Array<() => Promise<void>> = [];
    const setup = async (options: RelayOptions = {}) => {
      const store = await factory.make();
      const relay = makeRelay(store, { ...FAST, ...options });
      cleanup.push(async () => {
        await relay.stop();
        await store.close();
      });
      return { store, relay };
    };
    /**
     * A second relay, as a second pod would be: on Redis it gets its own connections to the same
     * server; the memory store can only be shared in-process.
     */
    const peerRelay = async (
      store: RoomStore,
      options: RelayOptions = {},
    ): Promise<CollabRelay> => {
      const own = store.kind === "redis" ? await factory.make() : store;
      const relay = makeRelay(own, { ...FAST, ...options });
      cleanup.push(async () => {
        await relay.stop();
        if (own !== store) await own.close();
      });
      return relay;
    };
    afterEach(async () => {
      for (const fn of cleanup.splice(0).reverse()) await fn();
    });

    describe("opening a session", () => {
      it("seeds the room from the host's diagram and returns a host credential", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { host, hostToken } = await hostRoom(relay, roomId, SEED);
        expect(hostToken.length).toBeGreaterThanOrEqual(40);
        const joined = await host.next("joined");
        expect(joined).toMatchObject({ role: "host", version: 0, catchup: [] });

        const guest = new FakeClient(user("guest"));
        await joinRoom(relay, roomId, guest);
        expect(await receivedSnapshot(guest)).toEqual(SEED);
      });

      it("does not serve a room whose seed is still arriving", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const host = new FakeClient(user("host")).attach(relay);
        host.write({
          type: "create",
          protocol: COLLAB_PROTOCOL_VERSION,
          roomId,
          user: host.user,
          seedChars: 10,
          seedChunks: 1,
        });
        await host.next("created");
        const guest = new FakeClient(user("guest")).attach(relay);
        guest.write({ type: "join", protocol: COLLAB_PROTOCOL_VERSION, roomId, user: guest.user });
        expect((await guest.next("error")).code).toBe("not_ready");
        expect(guest.all("snapshot:chunk")).toHaveLength(0);
      });

      it("refuses a diagram over the size limit with its size and the limit", async () => {
        const { relay } = await setup();
        const host = new FakeClient(user("host")).attach(relay);
        const seedChars = LIMITS.maxSeedChars + 1;
        host.write({
          type: "create",
          protocol: COLLAB_PROTOCOL_VERSION,
          roomId: nextRoomId(),
          user: host.user,
          seedChars,
          seedChunks: Math.ceil(seedChars / LIMITS.chunkChars),
        });
        expect(await host.next("error")).toMatchObject({
          code: "too_large",
          size: seedChars,
          limit: LIMITS.maxSeedChars,
        });
      });

      it("discards a room whose seed cannot be read", async () => {
        const { relay, store } = await setup();
        const roomId = nextRoomId();
        const host = new FakeClient(user("host")).attach(relay);
        host.write({
          type: "create",
          protocol: COLLAB_PROTOCOL_VERSION,
          roomId,
          user: host.user,
          seedChars: 5,
          seedChunks: 1,
        });
        await host.next("created");
        host.write({ type: "seed:chunk", index: 0, data: "{bad}" });
        host.write({ type: "seed:commit" });
        expect((await host.next("error")).code).toBe("invalid_seed");
        expect(await store.getMeta(roomId)).toBeNull();
      });

      it("refuses an id that is already taken", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        await hostRoom(relay, roomId, SEED);
        const other = new FakeClient(user("other")).attach(relay);
        other.write({
          type: "create",
          protocol: COLLAB_PROTOCOL_VERSION,
          roomId,
          user: other.user,
          seedChars: 2,
          seedChunks: 1,
        });
        expect((await other.next("error")).code).toBe("room_exists");
      });
    });

    describe("joining", () => {
      it("answers an unknown room explicitly", async () => {
        const { relay } = await setup();
        const guest = new FakeClient(user("guest")).attach(relay);
        guest.write({
          type: "join",
          protocol: COLLAB_PROTOCOL_VERSION,
          roomId: nextRoomId(),
          user: guest.user,
        });
        expect((await guest.next("error")).code).toBe("room_unknown");
      });

      it("refuses an older protocol and exchanges no state", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        await hostRoom(relay, roomId, SEED);
        const old = new FakeClient(user("old")).attach(relay);
        old.write({ type: "join", protocol: 2, roomId, user: old.user });
        expect((await old.next("error")).code).toBe("protocol_mismatch");
        expect(old.closed?.code).toBe(1008);
        expect(old.all("snapshot:chunk")).toHaveLength(0);
      });

      it("refuses the participant over capacity and names the limit", async () => {
        const { relay } = await setup({ maxParticipants: 3 });
        const roomId = nextRoomId();
        await hostRoom(relay, roomId, SEED);
        await joinRoom(relay, roomId, new FakeClient(user("g1")));
        await joinRoom(relay, roomId, new FakeClient(user("g2")));
        const extra = new FakeClient(user("g3")).attach(relay);
        extra.write({ type: "join", protocol: COLLAB_PROTOCOL_VERSION, roomId, user: extra.user });
        expect(await extra.next("error")).toMatchObject({ code: "room_full", limit: 3 });
        expect(extra.closed).not.toBeNull();
      });

      it("tells the others who joined and who left", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { host } = await hostRoom(relay, roomId, SEED);
        const guest = new FakeClient(user("guest"));
        const joined = await joinRoom(relay, roomId, guest);
        expect(joined.participants.map((p) => p.clientId).sort()).toEqual(["guest-id", "host-id"]);
        expect((await host.next("peer:joined")).participant.clientId).toBe("guest-id");
        guest.drop();
        expect(await host.next("peer:left")).toMatchObject({
          clientId: "guest-id",
          participantCount: 1,
        });
      });
    });

    describe("editing", () => {
      it("orders edits, confirms them, and sends them to everyone including the sender", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { host } = await hostRoom(relay, roomId, SEED);
        const guest = new FakeClient(user("guest"));
        await joinRoom(relay, roomId, guest);

        const opId = patch(guest, { entities: { nodeLayouts: { c1: { set: { x: 50 } } } } }, 0);
        expect(await guest.next("ack", (a) => a.opId === opId)).toMatchObject({
          applied: true,
          version: 1,
        });
        for (const client of [host, guest]) {
          expect(await client.next("entry", (e) => e.version === 1)).toMatchObject({
            opId,
            sender: "guest-id",
            patch: { entities: { nodeLayouts: { c1: { set: { x: 50 } } } } },
          });
        }
      });

      it("acknowledges a change that changes nothing without spending a version", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { host } = await hostRoom(relay, roomId, SEED);
        const opId = patch(host, { doc: { diagramName: "Payments" } }, 0);
        expect(await host.next("ack", (a) => a.opId === opId)).toMatchObject({
          applied: false,
          version: 0,
        });
        const next = patch(host, { doc: { diagramName: "Billing" } }, 0);
        expect(await host.next("ack", (a) => a.opId === next)).toMatchObject({ version: 1 });
        await host.next("entry", (e) => e.opId === next);
        expect(host.all("entry").map((e) => e.version)).toEqual([1]);
      });

      it("keeps both concurrent edits to different fields of one component", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { host } = await hostRoom(relay, roomId, SEED);
        const a = new FakeClient(user("a"));
        const b = new FakeClient(user("b"));
        await joinRoom(relay, roomId, a);
        await joinRoom(relay, roomId, b);
        patch(a, { entities: { components: { c1: { set: { name: "Gateway" } } } } }, 0);
        patch(b, { entities: { components: { c1: { set: { description: "Public" } } } } }, 0);
        await host.next("entry", (e) => e.version === 2);

        const late = new FakeClient(user("late"));
        await joinRoom(relay, roomId, late);
        const state = await receivedSnapshot(late);
        expect(state.entities.components.c1).toEqual({
          id: "c1",
          name: "Gateway",
          description: "Public",
        });
      });

      it("rate-limits a flooding participant without slowing the others", async () => {
        const { relay } = await setup({ patchRate: { rate: 5, burst: 5 } });
        const roomId = nextRoomId();
        const { host } = await hostRoom(relay, roomId, SEED);
        const flood = new FakeClient(user("flood"));
        await joinRoom(relay, roomId, flood);
        for (let i = 0; i < 20; i++) {
          patch(flood, { entities: { nodeLayouts: { c2: { set: { x: i + 1 } } } } }, 0);
        }
        await sleep(50);
        expect(flood.errors().filter((c) => c === "rate_limited").length).toBeGreaterThanOrEqual(
          10,
        );
        const opId = patch(host, { entities: { nodeLayouts: { c1: { set: { x: 999 } } } } }, 0);
        expect(await host.next("ack", (a) => a.opId === opId)).toMatchObject({ applied: true });
      });

      it("rejects a frame over the size cap without dropping the socket", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { host } = await hostRoom(relay, roomId, SEED);
        host.writeRaw("x".repeat(LIMITS.maxFrameChars + 1));
        expect((await host.next("error")).code).toBe("too_large");
        expect(host.closed).toBeNull();
      });

      it("hands a joiner during a burst exactly the room's state, then only newer entries", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { host } = await hostRoom(relay, roomId, SEED);
        const writer = new FakeClient(user("writer"));
        await joinRoom(relay, roomId, writer);
        for (let i = 1; i <= 40; i++) {
          patch(writer, { entities: { nodeLayouts: { c1: { set: { x: i } } } } }, 0);
        }
        const joiner = new FakeClient(user("joiner"));
        const joined = await joinRoom(relay, roomId, joiner);
        const state = await receivedSnapshot(joiner);
        await host.next("entry", (e) => e.version === 40);
        await sleep(20);
        const after = joiner.all("entry").map((e) => e.version);
        expect(after.every((v) => v > joined.version)).toBe(true);
        expect(after).toEqual(
          Array.from({ length: 40 - joined.version }, (_, i) => joined.version + i + 1),
        );
        const finalX = after.length > 0 ? 40 : state.entities.nodeLayouts.c1.x;
        expect(finalX).toBe(40);
      });
    });

    describe("reconnecting", () => {
      it("a guest that missed nothing gets an empty catch-up and is ready", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { epoch } = await hostRoom(relay, roomId, SEED);
        const guest = new FakeClient(user("guest"));
        await joinRoom(relay, roomId, guest);
        guest.drop();
        const again = new FakeClient(user("guest"));
        const joined = await joinRoom(relay, roomId, again, { resumeFrom: 0, resumeEpoch: epoch });
        expect(joined.catchup).toEqual([]);
        expect(again.all("snapshot:chunk")).toHaveLength(0);
      });

      it("a guest that missed edits gets exactly those, in order", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { host, epoch } = await hostRoom(relay, roomId, SEED);
        for (let i = 1; i <= 3; i++) patch(host, { doc: { diagramName: `v${i}` } }, i - 1);
        await host.next("entry", (e) => e.version === 3);
        const guest = new FakeClient(user("guest"));
        const joined = await joinRoom(relay, roomId, guest, { resumeFrom: 1, resumeEpoch: epoch });
        expect(joined.catchup?.map((e) => e.version)).toEqual([2, 3]);
        expect(joined.version).toBe(3);
      });

      it("a resume from an earlier incarnation of the room gets the snapshot", async () => {
        const { relay, store } = await setup();
        const roomId = nextRoomId();
        const { hostToken, epoch } = await hostRoom(relay, roomId, SEED);
        await store.discardRoom(roomId);
        const reborn = await hostRoom(relay, roomId, SEED, new FakeClient(user("host")), hostToken);
        expect(reborn.epoch).not.toBe(epoch);
        const guest = new FakeClient(user("guest"));
        const joined = await joinRoom(relay, roomId, guest, { resumeFrom: 0, resumeEpoch: epoch });
        expect(joined.catchup).toBeUndefined();
        expect(await receivedSnapshot(guest)).toEqual(SEED);
      });

      it("a resume the log cannot cover falls back to the snapshot", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { host } = await hostRoom(relay, roomId, SEED);
        patch(host, { doc: { diagramName: "x" } }, 0);
        await host.next("entry");
        const guest = new FakeClient(user("guest"));
        const joined = await joinRoom(relay, roomId, guest, { resumeFrom: 99 });
        expect(joined.catchup).toBeUndefined();
        expect((await receivedSnapshot(guest)).doc.diagramName).toBe("x");
      });
    });

    describe("host credential", () => {
      it("refuses a guest who claims to be the host", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        await hostRoom(relay, roomId, SEED);
        const impostor = new FakeClient(user("host")).attach(relay);
        impostor.write({
          type: "join",
          protocol: COLLAB_PROTOCOL_VERSION,
          roomId,
          user: impostor.user,
          hostToken: "guessed",
        });
        expect((await impostor.next("error")).code).toBe("unauthorized");
      });

      it("refuses a close from a guest and leaves the room open", async () => {
        const { relay, store } = await setup();
        const roomId = nextRoomId();
        await hostRoom(relay, roomId, SEED);
        const guest = new FakeClient(user("guest"));
        await joinRoom(relay, roomId, guest);
        guest.write({ type: "close" });
        expect((await guest.next("error")).code).toBe("unauthorized");
        expect((await store.getMeta(roomId))?.status).toBe("open");
      });

      it("a reseed for a room that exists is refused", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { hostToken } = await hostRoom(relay, roomId, SEED);
        const again = new FakeClient(user("host")).attach(relay);
        again.write({
          type: "create",
          protocol: COLLAB_PROTOCOL_VERSION,
          roomId,
          user: again.user,
          seedChars: 2,
          seedChunks: 1,
          hostToken,
        });
        expect((await again.next("error")).code).toBe("room_exists");
      });
    });

    describe("host lifecycle", () => {
      it("keeps the room working while the host is away and catches the host up", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { host, hostToken, epoch } = await hostRoom(relay, roomId, SEED);
        const guest = new FakeClient(user("guest"));
        await joinRoom(relay, roomId, guest);

        host.drop();
        expect((await guest.next("host:status", (s) => !s.online, 1_000)).online).toBe(false);
        const opId = patch(guest, { entities: { nodeLayouts: { c2: { set: { x: 1 } } } } }, 0);
        expect(await guest.next("ack", (a) => a.opId === opId)).toMatchObject({ applied: true });

        const back = new FakeClient(user("host"));
        const joined = await joinRoom(relay, roomId, back, {
          hostToken,
          resumeFrom: 0,
          resumeEpoch: epoch,
        });
        expect(joined.role).toBe("host");
        expect(joined.catchup?.map((e) => e.patch)).toEqual([
          { entities: { nodeLayouts: { c2: { set: { x: 1 } } } } },
        ]);
        expect((await guest.next("host:status", (s) => s.online)).online).toBe(true);
        await sleep(FAST.hostGraceMs! + 200);
        expect(guest.all("session:closed")).toHaveLength(0);
      });

      it("closes the session for everyone when the host does not return", async () => {
        const { relay, store } = await setup();
        const roomId = nextRoomId();
        const { host } = await hostRoom(relay, roomId, SEED);
        const guest = new FakeClient(user("guest"));
        await joinRoom(relay, roomId, guest);
        host.drop();
        expect((await guest.next("session:closed", () => true, 2_000)).reason).toBe("host_timeout");
        expect(guest.closed).not.toBeNull();
        expect((await store.getMeta(roomId))?.status).toBe("closed");
      });

      it("ends the session for everyone when the host closes it", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { host } = await hostRoom(relay, roomId, SEED);
        const guests = [new FakeClient(user("g1")), new FakeClient(user("g2"))];
        for (const g of guests) await joinRoom(relay, roomId, g);
        host.write({ type: "close" });
        for (const client of [host, ...guests]) {
          expect((await client.next("session:closed")).reason).toBe("host_closed");
        }
        const late = new FakeClient(user("late")).attach(relay);
        late.write({ type: "join", protocol: COLLAB_PROTOCOL_VERSION, roomId, user: late.user });
        expect((await late.next("error")).code).toBe("session_closed");
      });

      it("recreates a lost room from the host under the same credential", async () => {
        const { relay, store } = await setup();
        const roomId = nextRoomId();
        const { hostToken } = await hostRoom(relay, roomId, SEED);
        await store.discardRoom(roomId); // the storage lost it

        const host = new FakeClient(user("host")).attach(relay);
        host.write({
          type: "join",
          protocol: COLLAB_PROTOCOL_VERSION,
          roomId,
          user: host.user,
          hostToken,
        });
        expect((await host.next("error")).code).toBe("room_unknown");
        const reseeded = await hostRoom(
          relay,
          roomId,
          SEED,
          new FakeClient(user("host")),
          hostToken,
        );
        expect(reseeded.hostToken).toBe(hostToken);

        const guest = new FakeClient(user("guest"));
        await joinRoom(relay, roomId, guest);
        expect(await receivedSnapshot(guest)).toEqual(SEED);
      });
    });

    describe("storage loss", () => {
      it("tells everyone in a room the storage lost to reconnect, and the host brings it back", async () => {
        const { relay, store } = await setup();
        const roomId = nextRoomId();
        const { host, hostToken } = await hostRoom(relay, roomId, SEED);
        const guest = new FakeClient(user("guest"));
        await joinRoom(relay, roomId, guest);
        await store.discardRoom(roomId); // storage restarted without persistence
        await sleep(200);
        expect(host.closed?.code).toBe(4004);
        expect(guest.closed?.code).toBe(4004);

        const back = await hostRoom(relay, roomId, SEED, new FakeClient(user("host")), hostToken);
        expect(back.hostToken).toBe(hostToken);
        const again = new FakeClient(user("guest"));
        await joinRoom(relay, roomId, again);
        expect(await receivedSnapshot(again)).toEqual(SEED);
        // The fresh room is served live, from version 1 again.
        const opId = patch(again, { doc: { diagramName: "after" } }, 0);
        expect(await again.next("entry", (e) => e.opId === opId)).toMatchObject({ version: 1 });
      });
    });

    describe("presence", () => {
      it("grants a lock to one participant and tells the others who holds it", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { host } = await hostRoom(relay, roomId, SEED);
        const a = new FakeClient(user("a"));
        const b = new FakeClient(user("b"));
        await joinRoom(relay, roomId, a);
        await joinRoom(relay, roomId, b);

        a.write({ type: "lock", action: "acquire", entityId: "c1" });
        expect(await a.next("lock:result")).toMatchObject({ granted: true, holder: "a-id" });
        expect(await host.next("lock", (l) => l.entityId === "c1")).toMatchObject({
          holder: "a-id",
        });

        b.write({ type: "lock", action: "acquire", entityId: "c1" });
        expect(await b.next("lock:result")).toMatchObject({ granted: false, holder: "a-id" });
        const blocked = patch(b, { entities: { nodeLayouts: { c1: { set: { x: 7 } } } } }, 0);
        expect(await b.next("ack", (x) => x.opId === blocked)).toMatchObject({ applied: false });
      });

      it("frees a disconnected holder's locks", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { host } = await hostRoom(relay, roomId, SEED);
        const a = new FakeClient(user("a"));
        await joinRoom(relay, roomId, a);
        a.write({ type: "lock", action: "acquire", entityId: "c1" });
        await a.next("lock:result");
        a.drop();
        expect(await host.next("lock", (l) => l.holder === null)).toMatchObject({ entityId: "c1" });
      });

      it("coalesces cursors and drops them for a backed-up socket", async () => {
        const { relay } = await setup();
        const roomId = nextRoomId();
        const { host } = await hostRoom(relay, roomId, SEED);
        const a = new FakeClient(user("a"));
        await joinRoom(relay, roomId, a);
        for (let i = 0; i < 5; i++) {
          a.write({ type: "cursor", cursor: { x: i, y: i }, activeElementId: null });
        }
        const frame = await host.next("cursors");
        expect(frame.entries).toEqual([
          { clientId: "a-id", cursor: { x: 4, y: 4 }, activeElementId: null },
        ]);

        host.queued = 2 * 1024 * 1024;
        const before = host.all("cursors").length;
        a.write({ type: "cursor", cursor: { x: 9, y: 9 }, activeElementId: null });
        await sleep(80);
        expect(host.all("cursors").length).toBe(before);
        host.queued = 0;
        const opId = patch(a, { doc: { diagramName: "still delivered" } }, 0);
        await host.next("entry", (e) => e.opId === opId);
        expect(host.all("entry").length).toBe(1);
      });
    });

    describe("several relays on one store", () => {
      it("participants on different relays see each other's edits in one order", async () => {
        const { relay, store } = await setup();
        const other = await peerRelay(store);
        const roomId = nextRoomId();
        const { host } = await hostRoom(relay, roomId, SEED);
        const guest = new FakeClient(user("guest"));
        await joinRoom(other, roomId, guest);
        patch(guest, { entities: { nodeLayouts: { c1: { set: { x: 1 } } } } }, 0);
        patch(host, { entities: { nodeLayouts: { c2: { set: { x: 2 } } } } }, 0);
        await factory.settle();
        await host.next("entry", (e) => e.version === 2);
        await guest.next("entry", (e) => e.version === 2);
        expect(host.all("entry").map((e) => e.opId)).toEqual(guest.all("entry").map((e) => e.opId));
      });

      it("when the host is gone for good, exactly one close reaches each guest", async () => {
        const { relay, store } = await setup();
        const other = await peerRelay(store);
        const roomId = nextRoomId();
        const { host } = await hostRoom(relay, roomId, SEED);
        const guests = [new FakeClient(user("g1")), new FakeClient(user("g2"))];
        await joinRoom(relay, roomId, guests[0]);
        await joinRoom(other, roomId, guests[1]);
        host.drop();
        for (const g of guests) await g.next("session:closed", () => true, 3_000);
        await sleep(300);
        for (const g of guests) expect(g.all("session:closed")).toHaveLength(1);
      });

      it("the room survives the relay its host was on", async () => {
        const { relay, store } = await setup();
        const other = await peerRelay(store);
        const roomId = nextRoomId();
        const { hostToken, epoch } = await hostRoom(relay, roomId, SEED);
        const guest = new FakeClient(user("guest"));
        await joinRoom(other, roomId, guest);
        await relay.stop(); // the pod died
        const opId = patch(guest, { doc: { diagramName: "after" } }, 0);
        expect(await guest.next("ack", (a) => a.opId === opId)).toMatchObject({ applied: true });
        const host = new FakeClient(user("host"));
        const joined = await joinRoom(other, roomId, host, {
          hostToken,
          resumeFrom: 0,
          resumeEpoch: epoch,
        });
        expect(joined.catchup?.[0]?.patch).toEqual({ doc: { diagramName: "after" } });
      });
    });
  });
}
