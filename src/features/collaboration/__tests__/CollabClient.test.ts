import { afterEach, describe, expect, it } from "vitest";
import { makeState } from "../../../../server/src/collab/store/__fixtures__/merge.fixtures";
import type { DiagramState, Entry } from "@collab-protocol";
import { CollabClient, type ClientPhase, type ClosedReason } from "../sync/CollabClient";
import { createRig, tick, until, type Rig } from "./collabTestRig";

const SEED: DiagramState = makeState(
  {
    components: { c1: { id: "c1", name: "API" } },
    nodeLayouts: { c1: { elementId: "c1", x: 0, y: 0 } },
  },
  { diagramId: "d1", diagramName: "Payments", level: "context" },
);

let rig: Rig;
afterEach(async () => {
  await rig?.stop();
});

let counter = 0;
const roomId = () => `client-${Date.now()}-${++counter}`;

interface Probe {
  client: CollabClient;
  phases: ClientPhase[];
  snapshots: Array<{ version: number; state: DiagramState }>;
  catchups: Array<{ version: number; entries: Entry[] }>;
  entries: Entry[];
  closed: ClosedReason | null;
  token: string | null;
  resumeVersion: number | null;
}

function probe(
  role: "host" | "guest",
  room: string,
  extra: { hostToken?: string | null; seed?: DiagramState; name?: string } = {},
): Probe {
  const p: Probe = {
    client: null as unknown as CollabClient,
    phases: [],
    snapshots: [],
    catchups: [],
    entries: [],
    closed: null,
    token: null,
    resumeVersion: null,
  };
  const name = extra.name ?? role;
  p.client = new CollabClient({
    url: "ws://test/ws",
    roomId: room,
    user: { id: `${name}-id`, name, color: "#123" },
    role,
    hostToken: extra.hostToken ?? null,
    getSeed: role === "host" ? () => extra.seed ?? SEED : undefined,
    getResumeVersion: () => p.resumeVersion,
    createSocket: rig.createSocket,
    reconnectDelaysMs: [10, 20],
    notReadyRetryMs: 20,
    callbacks: {
      onPhase: (phase) => p.phases.push(phase),
      onSnapshot: (version, state) => p.snapshots.push({ version, state }),
      onCatchup: (version, entries) => p.catchups.push({ version, entries }),
      onEntry: (entry) => p.entries.push(entry),
      onAck: () => {},
      onHostToken: (token) => (p.token = token),
      onClosed: (reason) => (p.closed = reason),
    },
  });
  return p;
}

const ready = (p: Probe) => until(() => p.client.currentPhase === "ready", 3_000, "ready");

describe("CollabClient", () => {
  it("a host seeds the room and becomes ready through one path", async () => {
    rig = await createRig();
    const host = probe("host", roomId());
    host.client.start();
    await ready(host);
    expect(host.phases).toEqual(["connecting", "seeding", "ready"]);
    expect(host.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(host.catchups).toEqual([{ version: 0, entries: [] }]);
  });

  it("a guest gets the snapshot, then entries", async () => {
    rig = await createRig();
    const room = roomId();
    const host = probe("host", room);
    host.client.start();
    await ready(host);
    const guest = probe("guest", room);
    guest.client.start();
    await ready(guest);
    expect(guest.phases).toEqual(["connecting", "joining", "ready"]);
    expect(guest.snapshots).toEqual([{ version: 0, state: SEED }]);

    host.client.sendPatch({ doc: { diagramName: "Billing" } }, 0);
    await until(() => guest.entries.length === 1);
    expect(guest.entries[0]).toMatchObject({
      version: 1,
      patch: { doc: { diagramName: "Billing" } },
    });
  });

  it("a guest that reconnects having missed nothing is ready again (empty catch-up)", async () => {
    rig = await createRig();
    const room = roomId();
    const host = probe("host", room);
    host.client.start();
    await ready(host);
    const guest = probe("guest", room);
    guest.client.start();
    await ready(guest);

    guest.resumeVersion = 0;
    rig.sockets[rig.sockets.length - 1].drop();
    await until(() => guest.phases.includes("reconnecting"));
    await ready(guest);
    expect(guest.catchups).toEqual([{ version: 0, entries: [] }]);
    expect(guest.snapshots).toHaveLength(1);
  });

  it("a guest that cannot vouch for its state gets the snapshot again", async () => {
    rig = await createRig();
    const room = roomId();
    const host = probe("host", room);
    host.client.start();
    await ready(host);
    const guest = probe("guest", room);
    guest.client.start();
    await ready(guest);
    guest.resumeVersion = null;
    rig.sockets[rig.sockets.length - 1].drop();
    await until(() => guest.snapshots.length === 2);
    await ready(guest);
  });

  it("keeps retrying while the network is down, then gets back in", async () => {
    rig = await createRig();
    const room = roomId();
    const host = probe("host", room);
    host.client.start();
    await ready(host);
    const guest = probe("guest", room);
    guest.client.start();
    await ready(guest);
    rig.online = false;
    rig.sockets[rig.sockets.length - 1].drop();
    await tick(120);
    expect(guest.client.currentPhase).toBe("reconnecting");
    rig.online = true;
    await ready(guest);
  });

  it("a guest of an unknown room stops, and never tries to create it", async () => {
    rig = await createRig();
    const guest = probe("guest", roomId());
    guest.client.start();
    await until(() => guest.closed !== null);
    expect(guest.closed).toBe("room_unknown");
    const sent = rig.sockets.flatMap((s) => s.sentTypes());
    expect(sent).not.toContain("create");
  });

  it("waits for a room that is still seeding", async () => {
    rig = await createRig();
    const room = roomId();
    const host = probe("host", room);
    // The guest arrives first and is told the room is not there yet... then the host opens it.
    const guest = probe("guest", room);
    host.client.start();
    guest.client.start();
    await ready(host);
    await until(() => guest.client.currentPhase === "ready" || guest.closed !== null);
    // Depending on arrival order the guest either found it seeding (and retried) or unknown.
    if (guest.closed === null) expect(guest.snapshots[0]?.state).toEqual(SEED);
    else expect(guest.closed).toBe("room_unknown");
  });

  it("the host reseeds only after the relay says the room is unknown", async () => {
    rig = await createRig();
    const room = roomId();
    const host = probe("host", room);
    host.client.start();
    await ready(host);
    const token = host.token as string;
    await rig.store.discardRoom(room);

    const again = probe("host", room, { hostToken: token });
    again.client.start();
    await ready(again);
    const sent = rig.sockets[rig.sockets.length - 1].sentTypes();
    expect(sent.slice(0, 2)).toEqual(["join", "create"]);
    expect(again.closed).toBeNull();
  });

  it("a host with its credential rejoins without reseeding", async () => {
    rig = await createRig();
    const room = roomId();
    const host = probe("host", room);
    host.client.start();
    await ready(host);
    const again = probe("host", room, { hostToken: host.token });
    again.client.start();
    await ready(again);
    expect(rig.sockets[rig.sockets.length - 1].sentTypes()).not.toContain("create");
    expect(again.snapshots[0]?.state).toEqual(SEED);
  });

  it("refuses to seed a diagram over the size limit, locally", async () => {
    rig = await createRig();
    const big = makeState({
      components: { c: { id: "c", blob: "x".repeat(8 * 1024 * 1024 + 10) } },
    });
    const host = probe("host", roomId(), { seed: big });
    host.client.start();
    await until(() => host.closed !== null);
    expect(host.closed).toBe("too_large");
    expect(rig.sockets.flatMap((s) => s.sentTypes())).not.toContain("create");
  });

  it("the host ending the session closes it for the guests", async () => {
    rig = await createRig();
    const room = roomId();
    const host = probe("host", room);
    host.client.start();
    await ready(host);
    const guest = probe("guest", room);
    guest.client.start();
    await ready(guest);
    host.client.leave();
    await until(() => guest.closed !== null);
    expect(guest.closed).toBe("host_closed");
    expect(host.closed).toBe("left");
  });

  it("a host that drops silently is waited for, then the guests are told", async () => {
    rig = await createRig();
    const room = roomId();
    const host = probe("host", room);
    host.client.start();
    await ready(host);
    const guest = probe("guest", room);
    guest.client.start();
    await ready(guest);
    host.client.leaveSilently();
    await tick(150);
    expect(guest.closed).toBeNull();
    await until(() => guest.closed !== null, 3_000);
    expect(guest.closed).toBe("host_timeout");
  });

  it("a guest whose room vanished waits for the host to bring it back", async () => {
    rig = await createRig({ roomCheckMs: 30 });
    const room = roomId();
    const host = probe("host", room);
    host.client.start();
    await ready(host);
    const guest = probe("guest", room);
    guest.client.start();
    await ready(guest);
    guest.resumeVersion = 0;

    await rig.store.discardRoom(room);
    await until(() => guest.phases.filter((p) => p === "ready").length >= 2, 5_000, "guest back");
    expect(guest.closed).toBeNull();
    expect(host.closed).toBeNull();
    // The host reseeded: the guest got the host's copy as a fresh snapshot.
    expect(guest.snapshots[guest.snapshots.length - 1]?.state).toEqual(SEED);
  });
});
