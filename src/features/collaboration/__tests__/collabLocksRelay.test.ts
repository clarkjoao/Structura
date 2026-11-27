import { afterEach, describe, expect, it } from "vitest";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import { createCollabStore } from "../store/collab.store";
import { CollabSession } from "../sync/CollabSession";
import { createRig, until, type Rig } from "./collabTestRig";

/** Locks against the real relay: what a peer's disconnect does to the locks it held. */

let rig: Rig;
const sessions: CollabSession[] = [];
afterEach(async () => {
  for (const s of sessions.splice(0)) s.disconnect();
  await rig?.stop();
});

function open(
  role: "host" | "guest",
  roomId: string,
  diagramId: string | null,
  store = createTestDiagramStore(),
) {
  const collabStore = createCollabStore();
  const session = new CollabSession({
    url: "ws://test/ws",
    roomId,
    user: { id: `${role}-id`, name: role, color: "#123" },
    role,
    diagramId,
    diagramStore: store,
    collabStore,
    createSocket: rig.createSocket,
    sendIntervalMs: 10,
    reconnectDelaysMs: [10],
  });
  sessions.push(session);
  session.start();
  return {
    session,
    collabStore,
    ready: () =>
      until(() => collabStore.getState().isReady && collabStore.getState().status === "connected"),
  };
}

describe("locks and disconnects (real relay)", () => {
  it("frees every lock a peer held when it disconnects, without waiting for the ttl", async () => {
    rig = await createRig();
    const hostStore = createTestDiagramStore();
    const diagram = hostStore.getState().addDiagram("Locks", "context");
    hostStore.getState().openDiagram(diagram.id);
    hostStore.getState().addComponent("system", "A", null, { x: 0, y: 0 });
    const host = open("host", "locks-room", diagram.id, hostStore);
    await host.ready();
    const guest = open("guest", "locks-room", null);
    await guest.ready();

    host.session.client.sendLock("acquire", ["n1", "n2"]);
    await until(
      () => Object.keys(guest.collabStore.getState().locks).length === 2,
      3_000,
      "locks seen by the guest",
    );
    expect(guest.collabStore.getState().locks.n1!.holder).toBe("host-id");

    // The host's network dies and stays dead: no release message, no renew.
    rig.online = false;
    rig.sockets.find((s) => s.sentTypes().includes("create"))!.drop();
    await until(
      () => Object.keys(guest.collabStore.getState().locks).length === 0,
      1_500,
      "locks freed",
    );
  });
});

describe("malformed patches (real relay)", () => {
  // 38ed79ea "validate patch schema before applying" (collab Sec3)
  it("rejects a malformed patch frame without sequencing it, and tells no peer", async () => {
    rig = await createRig();
    const hostStore = createTestDiagramStore();
    const diagram = hostStore.getState().addDiagram("Raw", "context");
    hostStore.getState().openDiagram(diagram.id);
    hostStore.getState().addComponent("system", "A", null, { x: 0, y: 0 });
    const host = open("host", "raw-room", diagram.id, hostStore);
    await host.ready();
    const guest = open("guest", "raw-room", null);
    await guest.ready();

    const raw = rig.createSocket("ws://test/ws");
    const received: Array<Record<string, unknown>> = [];
    raw.onmessage = (event) => {
      const parsed = JSON.parse(String(event.data)) as unknown;
      for (const m of Array.isArray(parsed) ? parsed : [parsed]) received.push(m);
    };
    await until(() => raw.readyState === 1, 3_000, "raw socket open");
    raw.send(
      JSON.stringify({
        type: "join",
        protocol: 3,
        roomId: "raw-room",
        user: { id: "raw-id", name: "raw", color: "#123" },
      }),
    );
    await until(() => received.some((m) => m.type === "joined"), 3_000, "raw joined");
    const before = (await rig.store.getMeta("raw-room"))!.version;

    const bad = [
      { entities: { nodeLayouts: { n1: { set: { x: 1 }, drop: true } } } },
      { entities: { notACollection: {} } },
      { doc: { notAField: 1 } },
      { entities: { nodeLayouts: JSON.parse('{"__proto__": {"set": {"x": 1}}}') } },
      "not an object",
    ];
    bad.forEach((patch, i) =>
      raw.send(JSON.stringify({ type: "patch", opId: `raw:${i}`, baseVersion: before, patch })),
    );
    await until(
      () => received.filter((m) => m.type === "error").length === bad.length,
      3_000,
      "every bad patch refused",
    );

    expect(received.filter((m) => m.type === "ack" || m.type === "entry")).toEqual([]);
    expect((await rig.store.getMeta("raw-room"))!.version).toBe(before);
    expect(guest.session.client.currentPhase).toBe("ready");
  });
});
