import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import type { DiagramStore } from "@/features/diagram";
import type { StoreApi } from "zustand";
import { createCollabStore } from "../store/collab.store";
import { CollabSession } from "../sync/CollabSession";
import { diagramToState } from "../sync/diagramState";
import { createRig, tick, until, type Rig } from "./collabTestRig";

let rig: Rig;
const sessions: CollabSession[] = [];
afterEach(async () => {
  for (const s of sessions.splice(0)) s.disconnect();
  await rig?.stop();
  vi.unstubAllGlobals();
});

let counter = 0;

function hostDiagram(store: StoreApi<DiagramStore>): string {
  const state = store.getState();
  const diagram = state.addDiagram("Payments", "context", undefined, "folder-1");
  store.getState().openDiagram(diagram.id);
  const api = store.getState().addComponent("system", "API", null, { x: 0, y: 0 });
  const db = store.getState().addComponent("system", "DB", null, { x: 300, y: 0 });
  void api;
  void db;
  return diagram.id;
}

function open(
  role: "host" | "guest",
  roomId: string,
  diagramStore: StoreApi<DiagramStore>,
  options: { diagramId?: string | null; hostToken?: string | null; name?: string } = {},
) {
  const collabStore = createCollabStore();
  let token: string | null = null;
  const name = options.name ?? role;
  const session = new CollabSession({
    url: "ws://test/ws",
    roomId,
    user: { id: `${name}-id`, name, color: "#123" },
    role,
    diagramId: options.diagramId ?? null,
    hostToken: options.hostToken ?? null,
    diagramStore,
    collabStore,
    onHostToken: (t) => (token = t),
    createSocket: rig.createSocket,
    sendIntervalMs: 10,
    reconnectDelaysMs: [10, 20],
  });
  sessions.push(session);
  session.start();
  return {
    session,
    collabStore,
    token: () => token,
    ready: () =>
      until(() => collabStore.getState().isReady && collabStore.getState().status === "connected"),
  };
}

const layouts = (store: StoreApi<DiagramStore>, id: string) =>
  store.getState().diagrams[id]!.nodeLayouts;
const components = (store: StoreApi<DiagramStore>, id: string) =>
  store.getState().diagrams[id]!.snapshot.components;

async function pair() {
  rig = await createRig();
  const roomId = `session-${Date.now()}-${++counter}`;
  const hostStore = createTestDiagramStore();
  const diagramId = hostDiagram(hostStore);
  const host = open("host", roomId, hostStore, { diagramId });
  await host.ready();
  const guestStore = createTestDiagramStore();
  const guest = open("guest", roomId, guestStore);
  await guest.ready();
  return { roomId, diagramId, hostStore, guestStore, host, guest };
}

describe("CollabSession end to end", () => {
  it("a guest receives the host's diagram and opens it", async () => {
    const { diagramId, hostStore, guestStore } = await pair();
    expect(guestStore.getState().activeDiagramId).toBe(diagramId);
    expect(diagramToState(guestStore.getState().diagrams[diagramId]!)).toEqual(
      diagramToState(hostStore.getState().diagrams[diagramId]!),
    );
  });

  it("edits travel both ways", async () => {
    const { diagramId, hostStore, guestStore } = await pair();
    const [first, second] = Object.keys(layouts(hostStore, diagramId));
    guestStore.getState().updateNodeLayout(first!, { x: 777, y: 1 });
    hostStore.getState().updateNodeLayout(second!, { x: 888, y: 2 });
    await until(
      () =>
        layouts(hostStore, diagramId)[first!]?.x === 777 &&
        layouts(guestStore, diagramId)[second!]?.x === 888,
      3_000,
      "edits to cross",
    );
  });

  it("keeps both concurrent edits to different fields of one component", async () => {
    const { diagramId, hostStore, guestStore } = await pair();
    const id = Object.keys(components(hostStore, diagramId))[0]!;
    hostStore.getState().updateComponent(id, { name: "Gateway" });
    guestStore.getState().updateComponent(id, { description: "Public" });
    await until(() => {
      const h = components(hostStore, diagramId)[id]!;
      const g = components(guestStore, diagramId)[id]!;
      return (
        h.name === "Gateway" &&
        h.description === "Public" &&
        g.name === "Gateway" &&
        g.description === "Public"
      );
    });
  });

  it("applies incoming edits without animation frames (a background tab)", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const { diagramId, hostStore, guestStore } = await pair();
    const id = Object.keys(layouts(hostStore, diagramId))[0]!;
    guestStore.getState().updateNodeLayout(id, { x: 4242, y: 0 });
    await until(() => layouts(hostStore, diagramId)[id]?.x === 4242);
  });

  it("undo only reverts the local user's own work", async () => {
    const { diagramId, hostStore, guestStore } = await pair();
    const [x, y] = Object.keys(layouts(hostStore, diagramId));
    const before = layouts(guestStore, diagramId)[x!]!.x;
    guestStore.getState().pushHistoryBoundary();
    guestStore.getState().updateNodeLayout(x!, { x: before + 500, y: 0 });
    await until(() => layouts(hostStore, diagramId)[x!]?.x === before + 500);
    hostStore.getState().updateNodeLayout(y!, { x: 5555, y: 0 });
    await until(() => layouts(guestStore, diagramId)[y!]?.x === 5555);

    guestStore.getState().undo();
    expect(layouts(guestStore, diagramId)[x!]!.x).toBe(before);
    expect(layouts(guestStore, diagramId)[y!]!.x).toBe(5555);
    await until(() => layouts(hostStore, diagramId)[x!]?.x === before);
    expect(layouts(hostStore, diagramId)[y!]!.x).toBe(5555);
  });

  it("a host reload rejoins with its credential and keeps the diagram's folder and viewport", async () => {
    const { roomId, diagramId, hostStore, guestStore, host } = await pair();
    const token = host.token();
    expect(token).toBeTruthy();
    hostStore.setState((s) => ({
      diagrams: {
        ...s.diagrams,
        [diagramId]: { ...s.diagrams[diagramId]!, viewport: { x: 9, y: 9, zoom: 2 } },
      },
    }));
    host.session.disconnect();
    const id = Object.keys(layouts(guestStore, diagramId))[0]!;
    guestStore.getState().updateNodeLayout(id, { x: 31337, y: 0 });
    await tick(50);

    const back = open("host", roomId, hostStore, { diagramId, hostToken: token });
    await back.ready();
    await until(() => layouts(hostStore, diagramId)[id]?.x === 31337);
    const diagram = hostStore.getState().diagrams[diagramId]!;
    expect(diagram.folderId).toBe("folder-1");
    expect(diagram.viewport).toEqual({ x: 9, y: 9, zoom: 2 });
  });

  it("ending the session tells the guests, who keep their copy", async () => {
    const { diagramId, guestStore, host, guest } = await pair();
    host.session.leave();
    await until(() => guest.collabStore.getState().endReason !== null);
    expect(guest.collabStore.getState().endReason).toBe("host_closed");
    expect(guestStore.getState().diagrams[diagramId]).toBeDefined();
  });

  it("everyone converges on the room's state after a burst from both sides", async () => {
    const { diagramId, hostStore, guestStore } = await pair();
    const ids = Object.keys(layouts(hostStore, diagramId));
    for (let i = 0; i < 30; i++) {
      const store = i % 2 === 0 ? hostStore : guestStore;
      store.getState().updateNodeLayout(ids[i % ids.length]!, { x: i * 10, y: i });
      if (i % 5 === 0) await tick(3);
    }
    await until(
      () => {
        const h = diagramToState(hostStore.getState().diagrams[diagramId]!);
        const g = diagramToState(guestStore.getState().diagrams[diagramId]!);
        return JSON.stringify(h.entities) === JSON.stringify(g.entities);
      },
      3_000,
      "convergence",
    );
  });

  it("a peer's drag lock stops my move of that node, and frees when the holder leaves", async () => {
    const { diagramId, hostStore, guestStore, host, guest } = await pair();
    const id = Object.keys(layouts(hostStore, diagramId))[0]!;
    const original = layouts(guestStore, diagramId)[id]!.x;

    host.session.client.sendLock("acquire", id);
    await until(() => guest.collabStore.getState().locks[id] !== undefined, 3_000, "lock seen");
    expect(guest.collabStore.getState().locks[id]!.holder).toBe("host-id");

    // The guest moves it anyway (a race the UI would normally prevent): the relay drops the
    // guarded fields and the guest's view reverts.
    guestStore.getState().updateNodeLayout(id, { x: original + 999, y: 0 });
    await until(() => layouts(guestStore, diagramId)[id]?.x === original, 3_000, "revert");
    expect(layouts(hostStore, diagramId)[id]!.x).toBe(original);

    host.session.client.sendLock("release", id);
    await until(() => guest.collabStore.getState().locks[id] === undefined, 3_000, "release seen");
    guestStore.getState().updateNodeLayout(id, { x: original + 5, y: 0 });
    await until(() => layouts(hostStore, diagramId)[id]?.x === original + 5, 3_000, "free move");
  });

  it("shows peers' cursors but never my own", async () => {
    const { host, guest } = await pair();
    guest.session.updateCursor({ x: 10, y: 20 });
    host.session.updateCursor({ x: 1, y: 2 });
    await until(
      () => host.collabStore.getState().session?.peers.some((p) => p.cursor?.x === 10) ?? false,
      3_000,
      "guest cursor at host",
    );
    const hostPeers = host.collabStore.getState().session?.peers ?? [];
    expect(hostPeers.map((p) => p.clientId)).toEqual(["guest-id"]);
    guest.session.updateCursor(null);
    await until(
      () => host.collabStore.getState().session?.peers[0]?.cursor === null,
      3_000,
      "cursor cleared",
    );
  });
});
