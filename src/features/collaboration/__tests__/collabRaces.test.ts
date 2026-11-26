import { afterEach, describe, expect, it, vi } from "vitest";
import type { DiagramState, ServerMessage } from "@collab-protocol";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import type { DiagramStore } from "@/features/diagram";
import type { StoreApi } from "zustand";
import { createCollabStore } from "../store/collab.store";
import { CollabSession } from "../sync/CollabSession";
import type { SocketLike } from "../sync/CollabClient";
import { diagramToState } from "../sync/diagramState";

/**
 * Race tests over a scripted transport: no relay, no real time. Server frames wait in a queue
 * until the test delivers them, so each interleaving of "local edit", "peer entry", "ack" and
 * "reconnect" is fixed by the test instead of by scheduling luck.
 */

class ScriptedSocket implements SocketLike {
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  /** What the client wrote, parsed. */
  sent: Array<Record<string, unknown>> = [];
  /** Server frames not yet delivered. */
  private queue: string[] = [];

  constructor(readonly url: string) {}

  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }
  send(data: string): void {
    if (this.readyState === 1) this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close(): void {
    this.drop();
  }
  /** The network went away. Undelivered frames are lost with it. */
  drop(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.queue = [];
    this.onclose?.({});
  }

  /** The server says something; it waits until `deliver`. */
  enqueue(...messages: ServerMessage[]): void {
    for (const message of messages) this.queue.push(JSON.stringify(message));
  }
  /** Raw text, for frames that are not valid messages. */
  enqueueRaw(text: string): void {
    this.queue.push(text);
  }
  pending(): number {
    return this.queue.length;
  }
  /** Deliver the next `count` queued frames (all of them by default), in order. */
  deliver(count = this.queue.length): void {
    for (let i = 0; i < count; i++) {
      const frame = this.queue.shift();
      if (frame === undefined) return;
      this.onmessage?.({ data: frame });
    }
  }
  /** Drop the next queued frame, as a lost packet. */
  dropNext(): void {
    this.queue.shift();
  }
  sentOfType(type: string): Array<Record<string, unknown>> {
    return this.sent.filter((m) => m.type === type);
  }
}

type JoinedFrame = Extract<ServerMessage, { type: "joined" }>;

const USER = { id: "me", name: "Me", color: "#123" };

function seedState(): { state: DiagramState; ids: string[]; diagramId: string } {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Races", "context");
  store.getState().openDiagram(diagram.id);
  const ids = [0, 1].map(
    (i) => store.getState().addComponent("system", `C${i}`, null, { x: i * 100, y: 0 }).id,
  );
  return {
    state: diagramToState(store.getState().diagrams[diagram.id]!),
    ids,
    diagramId: diagram.id,
  };
}

const sessions: CollabSession[] = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.disconnect();
  vi.useRealTimers();
});

/** A guest session on a scripted transport, joined to a room whose state is `seed`. */
function setup() {
  vi.useFakeTimers();
  const seed = seedState();
  const sockets: ScriptedSocket[] = [];
  const diagramStore: StoreApi<DiagramStore> = createTestDiagramStore();
  const collabStore = createCollabStore();
  const session = new CollabSession({
    url: "ws://scripted",
    roomId: "room",
    user: USER,
    role: "guest",
    diagramId: null,
    diagramStore,
    collabStore,
    createSocket: (url) => {
      const socket = new ScriptedSocket(url);
      sockets.push(socket);
      return socket;
    },
    sendIntervalMs: 0,
    inboundBatchMs: 0,
    reconnectDelaysMs: [10],
  });
  sessions.push(session);
  session.start();

  const joinedFrame = (version: number): ServerMessage => ({
    type: "joined",
    clientId: USER.id,
    role: "guest",
    version,
    participants: [],
    maxParticipants: 15,
    hostOnline: true,
    epoch: "e1",
  });
  const snapshotFrames = (version: number, state: DiagramState): ServerMessage[] => [
    joinedFrame(version),
    { type: "snapshot:chunk", index: 0, total: 1, data: JSON.stringify(state) },
    { type: "snapshot:end", version },
  ];

  const socket = () => sockets[sockets.length - 1]!;
  socket().open();
  socket().enqueue(...snapshotFrames(0, seed.state));
  socket().deliver();

  const layouts = () => diagramStore.getState().diagrams[seed.diagramId]!.nodeLayouts;
  return {
    ...seed,
    sockets,
    socket,
    session,
    diagramStore,
    collabStore,
    layouts,
    joinedFrame,
    snapshotFrames,
    /** A local drag of `id` to `x`; flushes at once (send interval 0). */
    move: (id: string, x: number) => diagramStore.getState().updateNodeLayout(id, { x, y: 0 }),
    entry: (
      version: number,
      opId: string,
      sender: string,
      patch: Extract<ServerMessage, { type: "entry" }>["patch"],
    ): ServerMessage => ({ type: "entry", version, opId, sender, patch }),
  };
}

const moveOf = (id: string, x: number) => ({
  entities: { nodeLayouts: { [id]: { set: { x } } } },
});

describe("collaboration races (scripted transport)", () => {
  it("joins through the scripted transport and holds the room's state", () => {
    const t = setup();
    expect(t.collabStore.getState().status).toBe("connected");
    expect(Object.keys(t.layouts()).sort()).toEqual([...t.ids].sort());
  });

  // 15c1326a "keep a local edit that races an incoming patch"
  it("a local edit survives a peer's patch that arrives before the ack of that edit", () => {
    const t = setup();
    const [a, b] = t.ids as [string, string];

    t.move(a, 500);
    const sent = t.socket().sentOfType("patch");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ baseVersion: 0, patch: moveOf(a, 500) });

    // The peer's entry (made against version 0, so older than our op) lands before our ack.
    t.socket().enqueue(t.entry(1, "peer:1", "peer", moveOf(b, 900)));
    t.socket().deliver();
    expect(t.layouts()[b]!.x).toBe(900);
    expect(t.layouts()[a]!.x).toBe(500);

    // A peer writing the very field we have in flight does not snap our edit back either.
    t.socket().enqueue(t.entry(2, "peer:2", "peer", moveOf(a, 111)));
    t.socket().deliver();
    expect(t.layouts()[a]!.x).toBe(500);

    // Our own entry then lands after theirs and wins: the room ends where the editor is.
    t.socket().enqueue(t.entry(3, sent[0]!.opId as string, USER.id, moveOf(a, 500)), {
      type: "ack",
      opId: sent[0]!.opId as string,
      applied: true,
      version: 3,
    });
    t.socket().deliver();
    expect(t.layouts()[a]!.x).toBe(500);
    expect(t.layouts()[b]!.x).toBe(900);
  });

  // 15c1326a "send a client its own operation"
  it("receiving its own operation back (twice) applies it once and settles the client", () => {
    const t = setup();
    const [a] = t.ids as [string];

    t.move(a, 640);
    const opId = t.socket().sentOfType("patch")[0]!.opId as string;
    const own = t.entry(1, opId, USER.id, moveOf(a, 640));

    t.socket().enqueue(own, own);
    t.socket().deliver();

    expect(t.layouts()[a]!.x).toBe(640);
    expect(t.session.client.currentPhase).toBe("ready");
    expect(t.socket().sentOfType("patch")).toHaveLength(1);

    // Settled: a reconnect can vouch for version 1, so the in-flight op was dropped on its echo.
    t.socket().drop();
    vi.advanceTimersByTime(20);
    t.socket().open();
    expect(t.socket().sentOfType("join")[0]).toMatchObject({ resumeFrom: 1, resumeEpoch: "e1" });
  });

  it("my own echo is not a peer's change: undo still reverts my edit, a peer's stays", () => {
    const t = setup();
    const [a, b] = t.ids as [string, string];

    t.diagramStore.getState().pushHistoryBoundary();
    t.move(a, 640);
    const opId = t.socket().sentOfType("patch")[0]!.opId as string;
    t.socket().enqueue(
      t.entry(1, opId, USER.id, moveOf(a, 640)),
      t.entry(2, "peer:1", "peer", moveOf(b, 20)),
    );
    t.socket().deliver();
    expect(t.layouts()[a]!.x).toBe(640);
    expect(t.layouts()[b]!.x).toBe(20);

    t.diagramStore.getState().undo();
    expect(t.layouts()[a]!.x).toBe(0);
    expect(t.layouts()[b]!.x).toBe(20);
  });

  // 15c1326a "stop asking connected clients to resync"
  it("reconnecting with nothing pending resumes by catch-up: no snapshot, no second sync request", () => {
    const t = setup();
    const [a] = t.ids as [string];

    t.socket().drop();
    vi.advanceTimersByTime(20);
    expect(t.sockets).toHaveLength(2);
    t.socket().open();
    expect(t.socket().sentOfType("join")).toEqual([
      expect.objectContaining({ resumeFrom: 0, resumeEpoch: "e1" }),
    ]);

    // The server says "you are up to date" with an empty catch-up, and one missed entry follows.
    t.socket().enqueue({ ...(t.joinedFrame(0) as JoinedFrame), catchup: [] });
    t.socket().enqueue(t.entry(1, "peer:1", "peer", moveOf(a, 77)));
    t.socket().deliver();

    expect(t.collabStore.getState().status).toBe("connected");
    expect(t.layouts()[a]!.x).toBe(77);
    // Exactly one handshake message went out on the new socket: nothing asked for a resync.
    expect(t.socket().sent.map((m) => m.type)).toEqual(["join"]);
  });

  it("reconnecting with an unconfirmed op cannot vouch for a version, and sends the op once", () => {
    const t = setup();
    const [a] = t.ids as [string];

    t.move(a, 321);
    expect(t.socket().sentOfType("patch")).toHaveLength(1);
    // The link dies before the ack.
    t.socket().drop();
    vi.advanceTimersByTime(20);
    t.socket().open();

    const join = t.socket().sentOfType("join")[0]!;
    expect(join).not.toHaveProperty("resumeFrom");

    // The room answers with a full snapshot (the relay never saw the op) and the client takes it.
    t.socket().enqueue(...t.snapshotFrames(0, t.state));
    t.socket().deliver();
    expect(t.collabStore.getState().status).toBe("connected");
    expect(t.layouts()[a]!.x).toBe(0);
    // The in-flight op is not replayed behind the snapshot: the new socket carried one join only.
    expect(t.socket().sentOfType("patch")).toHaveLength(0);
    expect(t.sockets.flatMap((s) => s.sentOfType("patch"))).toHaveLength(1);
  });

  it("frames lost in the network leave the store as it was", () => {
    const t = setup();
    const [a] = t.ids as [string];
    t.socket().enqueue(t.entry(1, "peer:1", "peer", moveOf(a, 5)));
    t.socket().dropNext();
    t.socket().deliver();
    expect(t.layouts()[a]!.x).toBe(0);
  });

  // 38ed79ea "validate patch schema before applying" (collab Sec3)
  it("junk frames are ignored without touching the store", () => {
    const t = setup();
    const updates = vi.fn();
    t.diagramStore.subscribe(updates);

    t.socket().enqueueRaw("not json at all");
    t.socket().enqueueRaw("42");
    t.socket().enqueueRaw(JSON.stringify({ nope: true }));
    t.socket().enqueueRaw(JSON.stringify({ type: 7 }));
    t.socket().deliver();

    expect(updates).not.toHaveBeenCalled();
    expect(t.collabStore.getState().status).toBe("connected");
  });

  // 38ed79ea: the relay is the validator; its answer to a malformed patch is covered in
  // server/src/collab/relay.test.ts, and the client side of that answer is here.
  it("an invalid_message answer to a patch leaves the session and the store untouched", () => {
    const t = setup();
    const [a] = t.ids as [string];
    t.move(a, 55);
    t.socket().enqueue({ type: "error", code: "invalid_message", message: "bad patch" });
    t.socket().deliver();
    expect(t.session.client.currentPhase).toBe("ready");
    expect(t.layouts()[a]!.x).toBe(55);
  });

  // 15c1326a: a refused op reverts, a peer's entry stays.
  it("a refused op is undone locally while the peer's entry stays", () => {
    const t = setup();
    const [a, b] = t.ids as [string, string];
    t.move(a, 500);
    const opId = t.socket().sentOfType("patch")[0]!.opId as string;
    t.socket().enqueue(t.entry(1, "peer:1", "peer", moveOf(b, 900)), {
      type: "ack",
      opId,
      applied: false,
      version: 1,
    });
    t.socket().deliver();
    expect(t.layouts()[a]!.x).toBe(0);
    expect(t.layouts()[b]!.x).toBe(900);
  });

  it("a peer's lock reaches the store, is freed by the holder's release, and expires if never renewed", () => {
    const t = setup();
    const [a, b] = t.ids as [string, string];
    const locks = () => t.collabStore.getState().locks;

    t.socket().enqueue(
      { type: "lock", entityId: a, holder: "peer-1", ttlMs: 3000 },
      { type: "lock", entityId: b, holder: "peer-1", ttlMs: 3000 },
    );
    t.socket().deliver();
    expect(Object.keys(locks()).sort()).toEqual([a, b].sort());

    t.socket().enqueue({ type: "lock", entityId: a, holder: null, ttlMs: 0 });
    t.socket().deliver();
    expect(Object.keys(locks())).toEqual([b]);

    // The holder vanished (no release, no renew): the lock goes away by itself at its ttl.
    vi.advanceTimersByTime(2999);
    expect(Object.keys(locks())).toEqual([b]);
    vi.advanceTimersByTime(2);
    expect(locks()).toEqual({});
  });

  it("my own lock echo is not shown as a lock held by someone else", () => {
    const t = setup();
    const [a] = t.ids as [string];
    t.socket().enqueue({ type: "lock", entityId: a, holder: USER.id, ttlMs: 3000 });
    t.socket().deliver();
    expect(t.collabStore.getState().locks).toEqual({});
  });
});
