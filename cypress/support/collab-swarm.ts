/**
 * Node-side load for the collaboration stress spec: a swarm of protocol-v3 guests that join
 * the room the browser hosts and edit it as fast as the relay allows, plus an observer that
 * reads the relay's settled state at the end. Runs inside `setupNodeEvents`, never in the page.
 *
 * Each bot behaves like a person who never stops: it moves single nodes, renames components,
 * streams its cursor, and every few seconds grabs a whole group (one batched `lock`), drags it
 * for a while with renewals, and lets go. It stays under the relay's per-client rates on
 * purpose — the stress is the sum of the bots, and a `rate_limited` reply is a finding.
 */

const PROTOCOL = 3;

export interface SwarmOptions {
  /** Relay URLs; bots are spread across them round-robin (several relays share Redis). */
  urls: string[];
  roomId: string;
  bots: number;
  /** Per bot: time between single-node patches. The relay allows 30/s. */
  patchEveryMs?: number;
  /** Per bot: time between cursor frames. The relay allows 20/s. */
  cursorEveryMs?: number;
  /** Per bot: time between group drags (a batched lock, moves, a release). */
  groupEveryMs?: number;
  groupSize?: number;
}

export interface BotStats {
  id: string;
  url: string;
  ready: boolean;
  patchesSent: number;
  applied: number;
  refused: number;
  entriesSeen: number;
  lockMessagesSent: number;
  locksGranted: number;
  locksDenied: number;
  errors: Record<string, number>;
  /** Round trip from sending a patch to seeing it come back as an entry. */
  echoMs: number[];
  reconnects: number;
}

export interface SwarmReport {
  bots: BotStats[];
  totals: {
    patchesSent: number;
    applied: number;
    refused: number;
    locksGranted: number;
    locksDenied: number;
    errors: Record<string, number>;
    echoP50: number;
    echoP95: number;
    echoMax: number;
  };
}

export interface RoomSnapshot {
  version: number;
  nodeLayouts: Record<string, { x: number; y: number }>;
  componentNames: Record<string, string>;
  /** User ids the relay lists in the room, the observer excluded. */
  participants: string[];
}

type Msg = Record<string, unknown> & { type: string };

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
}

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)]!;

function sample<T>(items: T[], n: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}

/** One socket that joins a room as a guest and reads the snapshot. */
class Peer {
  ws: WebSocket | null = null;
  version = 0;
  ready = false;
  state: Record<string, unknown> | null = null;
  participants: string[] = [];
  private chunks: string[] = [];
  private readyWaiters: Array<() => void> = [];
  closed = false;

  constructor(
    readonly url: string,
    readonly roomId: string,
    readonly user: { id: string; name: string; color: string },
    private readonly onMessage: (m: Msg) => void = () => {},
  ) {}

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      const timer = setTimeout(() => reject(new Error(`${this.user.id}: no snapshot`)), 20_000);
      this.readyWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
      ws.onopen = () =>
        this.send({ type: "join", protocol: PROTOCOL, roomId: this.roomId, user: this.user });
      ws.onerror = () => {};
      ws.onclose = () => {
        this.ready = false;
        this.closed = true;
      };
      ws.onmessage = (event) => {
        const m = JSON.parse(String(event.data)) as Msg;
        this.handle(m);
        this.onMessage(m);
      };
    });
  }

  send(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  close(): void {
    this.ready = false;
    try {
      this.ws?.close();
    } catch {
      // already gone
    }
  }

  private handle(m: Msg): void {
    switch (m.type) {
      case "ping":
        this.send({ type: "pong" });
        return;
      case "joined":
        this.version = Number(m.version);
        this.participants = (Array.isArray(m.participants) ? m.participants : []).map((p) =>
          String(record(record(p).user).id),
        );
        this.chunks = [];
        return;
      case "snapshot:chunk":
        this.chunks[Number(m.index)] = String(m.data);
        return;
      case "snapshot:end":
        this.state = record(JSON.parse(this.chunks.join("")));
        this.chunks = [];
        this.version = Number(m.version);
        this.ready = true;
        for (const done of this.readyWaiters.splice(0)) done();
        return;
      case "entry":
        if (Number(m.version) > this.version) this.version = Number(m.version);
        return;
      default:
        return;
    }
  }
}

class Bot {
  readonly stats: BotStats;
  private peer: Peer;
  private timers: ReturnType<typeof setInterval>[] = [];
  private nodeIds: string[] = [];
  private componentIds: string[] = [];
  /** Entities someone else holds, from `lock` presence frames. */
  private heldByOthers = new Set<string>();
  private group: string[] = [];
  private seq = 0;
  private sentAt = new Map<string, number>();

  constructor(
    readonly index: number,
    url: string,
    roomId: string,
    private readonly opts: Required<Omit<SwarmOptions, "urls" | "roomId" | "bots">>,
  ) {
    const id = `bot-${index}`;
    this.stats = {
      id,
      url,
      ready: false,
      patchesSent: 0,
      applied: 0,
      refused: 0,
      entriesSeen: 0,
      lockMessagesSent: 0,
      locksGranted: 0,
      locksDenied: 0,
      errors: {},
      echoMs: [],
      reconnects: 0,
    };
    this.peer = new Peer(
      url,
      roomId,
      { id, name: `Bot ${index}`, color: `hsl(${(index * 47) % 360} 70% 45%)` },
      (m) => this.onMessage(m),
    );
  }

  async start(): Promise<void> {
    await this.peer.open();
    this.stats.ready = true;
    const entities = record(this.peer.state?.entities);
    this.nodeIds = Object.keys(record(entities.nodeLayouts));
    this.componentIds = Object.keys(record(entities.components));

    const jitter = () => Math.random() * 200;
    setTimeout(() => {
      this.timers.push(setInterval(() => this.moveOne(), this.opts.patchEveryMs));
    }, jitter());
    setTimeout(() => {
      this.timers.push(setInterval(() => this.cursor(), this.opts.cursorEveryMs));
    }, jitter());
    setTimeout(
      () => {
        this.timers.push(setInterval(() => this.groupDrag(), this.opts.groupEveryMs));
      },
      jitter() + Math.random() * this.opts.groupEveryMs,
    );
  }

  stop(): void {
    for (const t of this.timers.splice(0)) clearInterval(t);
    if (this.group.length > 0) this.lock("release", this.group);
    this.group = [];
  }

  close(): void {
    this.stop();
    this.peer.close();
  }

  private onMessage(m: Msg): void {
    switch (m.type) {
      case "entry": {
        this.stats.entriesSeen += 1;
        const sent = this.sentAt.get(String(m.opId));
        if (sent !== undefined) {
          this.stats.echoMs.push(Date.now() - sent);
          this.sentAt.delete(String(m.opId));
        }
        // Nodes others create (the browser duplicating a selection) join the pool.
        const layouts = record(record(m.patch).entities).nodeLayouts;
        for (const [id, value] of Object.entries(record(layouts))) {
          if (value === null) this.nodeIds = this.nodeIds.filter((n) => n !== id);
          else if (!this.nodeIds.includes(id)) this.nodeIds.push(id);
        }
        return;
      }
      case "ack":
        if (m.applied) this.stats.applied += 1;
        else this.stats.refused += 1;
        return;
      case "lock":
        if (m.holder && m.holder !== this.stats.id) this.heldByOthers.add(String(m.entityId));
        else if (!m.holder) this.heldByOthers.delete(String(m.entityId));
        return;
      case "lock:result":
        if (m.granted) this.stats.locksGranted += 1;
        else {
          this.stats.locksDenied += 1;
          this.group = this.group.filter((id) => id !== m.entityId);
        }
        return;
      case "error": {
        const code = String(m.code);
        this.stats.errors[code] = (this.stats.errors[code] ?? 0) + 1;
        return;
      }
      default:
        return;
    }
  }

  private patch(entities: Record<string, Record<string, unknown>>): void {
    if (!this.peer.ready) return;
    const opId = `${this.stats.id}|${++this.seq}`;
    this.sentAt.set(opId, Date.now());
    this.stats.patchesSent += 1;
    this.peer.send({
      type: "patch",
      opId,
      baseVersion: this.peer.version,
      patch: { entities },
    });
  }

  private lock(action: "acquire" | "renew" | "release", ids: string[]): void {
    if (ids.length === 0) return;
    this.stats.lockMessagesSent += 1;
    this.peer.send({ type: "lock", action, entityIds: ids });
  }

  private free(): string[] {
    return this.nodeIds.filter((id) => !this.heldByOthers.has(id) && !this.group.includes(id));
  }

  private moveOne(): void {
    const free = this.free();
    if (free.length === 0) return;
    const id = pick(free);
    const entities: Record<string, Record<string, unknown>> = {
      nodeLayouts: {
        [id]: {
          set: {
            x: Math.round(Math.random() * 2400),
            y: Math.round(Math.random() * 1400),
          },
        },
      },
    };
    // Every tenth edit also renames a component — a guarded field too.
    if (this.seq % 10 === 0 && this.componentIds.length > 0) {
      const target = pick(this.componentIds);
      if (!this.heldByOthers.has(target)) {
        entities.components = { [target]: { set: { name: `${this.stats.id} #${this.seq}` } } };
      }
    }
    this.patch(entities);
  }

  private cursor(): void {
    this.peer.send({
      type: "cursor",
      cursor: { x: Math.random() * 2400, y: Math.random() * 1400 },
      activeElementId: null,
    });
  }

  /** Lock a group in one message, drag it for ~1.2s while renewing, then let go. */
  private groupDrag(): void {
    if (this.group.length > 0) return;
    const ids = sample(this.free(), this.opts.groupSize);
    if (ids.length === 0) return;
    this.group = ids;
    this.lock("acquire", ids);
    const dx = Math.round(Math.random() * 60 - 30);
    const dy = Math.round(Math.random() * 60 - 30);
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      if (this.group.length > 0) {
        const layouts: Record<string, unknown> = {};
        for (const id of this.group) {
          layouts[id] = {
            set: { x: 200 + ((this.index * 37 + step * dx) % 2000), y: 200 + step * dy },
          };
        }
        this.patch({ nodeLayouts: layouts });
      }
      if (step === 3) this.lock("renew", this.group);
      if (step >= 6) {
        clearInterval(timer);
        this.timers = this.timers.filter((t) => t !== timer);
        this.lock("release", this.group);
        this.group = [];
      }
    }, 200);
    this.timers.push(timer);
  }
}

let swarm: Bot[] = [];

export async function startSwarm(options: SwarmOptions): Promise<{ ready: number }> {
  await stopSwarm();
  const opts = {
    patchEveryMs: options.patchEveryMs ?? 100,
    cursorEveryMs: options.cursorEveryMs ?? 100,
    groupEveryMs: options.groupEveryMs ?? 3_000,
    groupSize: options.groupSize ?? 25,
  };
  swarm = Array.from(
    { length: options.bots },
    (_, i) => new Bot(i, options.urls[i % options.urls.length]!, options.roomId, opts),
  );
  const results = await Promise.allSettled(swarm.map((b) => b.start()));
  return { ready: results.filter((r) => r.status === "fulfilled").length };
}

/** Stop editing but stay connected, so the room can settle with everyone still in it. */
export function quietSwarm(): null {
  for (const bot of swarm) bot.stop();
  return null;
}

export async function stopSwarm(): Promise<SwarmReport> {
  const bots = swarm;
  swarm = [];
  for (const bot of bots) bot.close();
  const stats = bots.map((b) => b.stats);
  const echo = stats.flatMap((s) => s.echoMs).sort((a, b) => a - b);
  const errors: Record<string, number> = {};
  for (const s of stats)
    for (const [code, n] of Object.entries(s.errors)) errors[code] = (errors[code] ?? 0) + n;
  const sum = (key: keyof BotStats) => stats.reduce((acc, s) => acc + Number(s[key]), 0);
  return {
    bots: stats.map((s) => ({ ...s, echoMs: [] })),
    totals: {
      patchesSent: sum("patchesSent"),
      applied: sum("applied"),
      refused: sum("refused"),
      locksGranted: sum("locksGranted"),
      locksDenied: sum("locksDenied"),
      errors,
      echoP50: percentile(echo, 50),
      echoP95: percentile(echo, 95),
      echoMax: echo[echo.length - 1] ?? 0,
    },
  };
}

/** A fresh guest's view of the room: the relay's settled state, nothing the browser computed. */
export async function readRoom(options: { url: string; roomId: string }): Promise<RoomSnapshot> {
  const peer = new Peer(options.url, options.roomId, {
    id: `observer-${Date.now()}`,
    name: "Observer",
    color: "#000000",
  });
  await peer.open();
  peer.close();
  const entities = record(peer.state?.entities);
  const nodeLayouts: RoomSnapshot["nodeLayouts"] = {};
  for (const [id, layout] of Object.entries(record(entities.nodeLayouts))) {
    const l = record(layout);
    nodeLayouts[id] = { x: Number(l.x), y: Number(l.y) };
  }
  const componentNames: Record<string, string> = {};
  for (const [id, c] of Object.entries(record(entities.components))) {
    componentNames[id] = String(record(c).name);
  }
  const participants = peer.participants.filter((id) => !id.startsWith("observer-"));
  return { version: peer.version, nodeLayouts, componentNames, participants };
}

/** Move nodes as one peer, once — the case where the browser must follow a remote write. */
export async function movePeerOnce(options: {
  url: string;
  roomId: string;
  moves: Record<string, { x: number; y: number }>;
}): Promise<{ applied: boolean }> {
  let applied = false;
  const done = new Promise<void>((resolve) => {
    const peer = new Peer(
      options.url,
      options.roomId,
      { id: `mover-${Date.now()}`, name: "Mover", color: "#ff0000" },
      (m) => {
        if (m.type === "ack") {
          applied = Boolean(m.applied);
          peer.close();
          resolve();
        }
      },
    );
    void peer.open().then(() => {
      const layouts: Record<string, unknown> = {};
      for (const [id, pos] of Object.entries(options.moves)) layouts[id] = { set: pos };
      peer.send({
        type: "patch",
        opId: `mover|${Date.now()}`,
        baseVersion: peer.version,
        patch: { entities: { nodeLayouts: layouts } },
      });
    });
  });
  await Promise.race([done, new Promise((r) => setTimeout(r, 10_000))]);
  return { applied };
}

/** One peer that stays in the room and points where the spec tells it to. */
let pointer: Peer | null = null;
/** Cursors the pointer peer received from others, last one per client. */
let seenCursors: Record<string, { x: number; y: number } | null> = {};

export async function startPointerPeer(options: {
  url: string;
  roomId: string;
  name: string;
}): Promise<null> {
  pointer?.close();
  seenCursors = {};
  pointer = new Peer(
    options.url,
    options.roomId,
    { id: `pointer-${Date.now()}`, name: options.name, color: "#e11d48" },
    (m) => {
      if (m.type !== "cursors" || !Array.isArray(m.entries)) return;
      for (const entry of m.entries) {
        const e = record(entry);
        if (String(e.clientId) === pointer?.user.id) continue;
        const cursor = record(e.cursor);
        seenCursors[String(e.clientId)] =
          e.cursor === null ? null : { x: Number(cursor.x), y: Number(cursor.y) };
      }
    },
  );
  await pointer.open();
  return null;
}

/** Put the pointer peer's cursor at a flow point (the diagram's own coordinates). */
export function movePointerPeer(options: { x: number; y: number }): null {
  pointer?.send({ type: "cursor", cursor: { x: options.x, y: options.y }, activeElementId: null });
  return null;
}

export function stopPointerPeer(): null {
  pointer?.close();
  pointer = null;
  return null;
}

/** The cursors the pointer peer has seen, by client id. */
export function pointerPeerSeen(): Record<string, { x: number; y: number } | null> {
  return seenCursors;
}
