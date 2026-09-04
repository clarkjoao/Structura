/**
 * Load driver worker — owns a contiguous range of rooms and drives traffic.
 *
 * Sharded across processes so the driver itself does not become the
 * bottleneck and distort the server's numbers. Reports aggregates to the
 * orchestrator over IPC.
 */
import WebSocket from "ws";

interface Cfg {
  url: string;
  roomStart: number;
  roomEnd: number; // exclusive
  perRoom: number;
  editorsPerRoom: number;
  mousemoveHz: number;
  cursorHz: number;
  patchHz: number;
  payloadNodes: number;
  durationMs: number;
  patchMode: "collection" | "entity";
}

const cfg: Cfg = JSON.parse(process.env.LT_CFG!);

const stats = {
  connected: 0,
  connectFailed: 0,
  sent: 0,
  received: 0,
  errors: {} as Record<string, number>,
  latencies: [] as number[],
  patchLatencies: [] as number[],
  bytesSent: 0,
  sendErrors: 0,
  syncRequired: 0,
  syncComplete: 0,
  opsReplayed: 0,
};

function noteError(code: string): void {
  stats.errors[code] = (stats.errors[code] ?? 0) + 1;
}

/** A realistic nodeLayouts collection — this is what LWW ships on every patch. */
function makeNodeLayouts(n: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < n; i++) {
    out[`node-${i}`] = {
      x: Math.random() * 2000,
      y: Math.random() * 2000,
      width: 180,
      height: 90,
    };
  }
  return out;
}

function makeSnapshot(nodes: number): Record<string, unknown> {
  return {
    diagramId: "d",
    diagramName: "Load Test Diagram",
    level: "container",
    domain: null,
    description: null,
    components: {},
    connections: {},
    flows: {},
    nodeLayouts: makeNodeLayouts(nodes),
    edgeLayouts: {},
    iconLibrary: {},
    scenes: {},
    activeSceneId: null,
    compareSceneId: null,
  };
}

interface Client {
  ws: WebSocket;
  roomId: string;
  clientId: string;
  isHost: boolean;
  isEditor: boolean;
  ready: boolean;
  baseVersion: number;
  knownVersion: number;
}

const clients: Client[] = [];
const timers: ReturnType<typeof setInterval>[] = [];

function send(c: Client, obj: unknown): void {
  if (c.ws.readyState !== WebSocket.OPEN) return;
  const s = JSON.stringify(obj);
  try {
    c.ws.send(s);
    stats.sent++;
    stats.bytesSent += s.length;
  } catch {
    stats.sendErrors++;
  }
}

function connectClient(roomIdx: number, seat: number): Promise<void> {
  return new Promise((resolve) => {
    const roomId = `load-room-${roomIdx}`;
    const clientId = `u${roomIdx}-${seat}`;
    const isHost = seat === 0;
    const ws = new WebSocket(cfg.url, { perMessageDeflate: false });
    const c: Client = { ws, roomId, clientId, isHost, isEditor: seat < cfg.editorsPerRoom, ready: false, baseVersion: 0, knownVersion: 0 };

    const giveUp = setTimeout(() => {
      stats.connectFailed++;
      resolve();
    }, 30_000);

    ws.on("open", () => {
      const user = { id: clientId, name: `User ${clientId}`, color: "#abcdef" };
      if (isHost) {
        send(c, {
          type: "host:join",
        protocol: 2,
          roomId,
          diagramId: roomId,
          user,
          snapshot: makeSnapshot(cfg.payloadNodes),
        });
      } else {
        send(c, { type: "guest:join",
        protocol: 2, roomId, user });
      }
    });

    ws.on("message", (raw) => {
      stats.received++;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      const type = msg.type;

      if (type === "host:ack" || type === "session:init") {
        if (typeof msg.version === "number") {
          c.baseVersion = msg.version;
          c.knownVersion = msg.version;
        }
        if (!c.ready) {
          c.ready = true;
          stats.connected++;
          clearTimeout(giveUp);
          resolve();
        }
        return;
      }

      if (type === "error") {
        noteError(String(msg.code ?? "unknown"));
        if (!c.ready) {
          clearTimeout(giveUp);
          stats.connectFailed++;
          resolve();
        }
        return;
      }

      if (type === "OP_ACK") {
        if (typeof msg.version === "number" && msg.version > c.knownVersion) {
          c.knownVersion = msg.version;
        }
        return;
      }

      // Mirror the real client: a SYNC_REQUIRED prompts a sync:request from
      // the last synced base version.
      if (type === "SYNC_REQUIRED") {
        stats.syncRequired++;
        send(c, { type: "sync:request", roomId: c.roomId, baseVersion: c.baseVersion });
        return;
      }
      if (type === "SYNC_COMPLETE") {
        stats.syncComplete++;
        const ops = Array.isArray(msg.operations) ? msg.operations : [];
        stats.opsReplayed += ops.length;
        if (typeof msg.version === "number") c.baseVersion = msg.version;
        return;
      }
      if (type === "SYNC_SNAPSHOT") {
        stats.syncComplete++;
        if (typeof msg.version === "number") c.baseVersion = msg.version;
        return;
      }

      // Cursor round trip: t0 is encoded in activeElementId as "<id>|<t0>".
      // The server coalesces a room's cursors into one peer:cursors frame.
      const noteCursor = (aid: unknown): void => {
        if (typeof aid !== "string") return;
        const bar = aid.lastIndexOf("|");
        if (bar <= 0) return;
        const t0 = Number(aid.slice(bar + 1));
        if (Number.isFinite(t0)) stats.latencies.push(Date.now() - t0);
      };

      if (type === "peer:cursors") {
        const list = Array.isArray(msg.cursors) ? msg.cursors : [];
        for (const e of list) {
          if (e && typeof e === "object") noteCursor((e as Record<string, unknown>).activeElementId);
        }
        return;
      }

      if (type === "peer:cursor") {
        noteCursor(msg.activeElementId);
        return;
      }

      // Patch round trip: t0 rides inside the patch itself.
      if (type === "session:patch") {
        if (typeof msg.version === "number" && msg.version > c.knownVersion) {
          c.knownVersion = msg.version;
        }
        const patch = msg.patch as Record<string, unknown> | undefined;
        const t0 = patch?.__t0;
        if (typeof t0 === "number") stats.patchLatencies.push(Date.now() - t0);
        return;
      }
    });

    ws.on("error", () => {
      if (!c.ready) {
        clearTimeout(giveUp);
        stats.connectFailed++;
        resolve();
      }
    });

    clients.push(c);
  });
}

async function main(): Promise<void> {
  // Connect hosts first so rooms exist before guests arrive.
  for (let r = cfg.roomStart; r < cfg.roomEnd; r++) {
    await connectClient(r, 0);
  }
  const guestWaits: Promise<void>[] = [];
  for (let r = cfg.roomStart; r < cfg.roomEnd; r++) {
    for (let s = 1; s < cfg.perRoom; s++) {
      guestWaits.push(connectClient(r, s));
    }
  }
  await Promise.all(guestWaits);

  process.send?.({ t: "connected", connected: stats.connected, failed: stats.connectFailed });

  const ready = clients.filter((c) => c.ready);

  // The activeElement firehose: every pointermove sends a peer:cursor.
  if (cfg.mousemoveHz > 0) {
    const period = Math.max(1, Math.round(1000 / cfg.mousemoveHz));
    timers.push(
      setInterval(() => {
        for (const c of ready) {
          send(c, {
            type: "peer:cursor",
            roomId: c.roomId,
            cursor: { x: Math.random() * 1000, y: Math.random() * 1000 },
            activeElementId: `node-${(Math.random() * cfg.payloadNodes) | 0}|${Date.now()}`,
          });
        }
      }, period),
    );
  }

  // Throttled cursor stream (33ms in the real client).
  if (cfg.cursorHz > 0) {
    const period = Math.max(1, Math.round(1000 / cfg.cursorHz));
    timers.push(
      setInterval(() => {
        for (const c of ready) {
          send(c, {
            type: "peer:cursor",
            roomId: c.roomId,
            cursor: { x: Math.random() * 1000, y: Math.random() * 1000 },
            activeElementId: null,
          });
        }
      }, period),
    );
  }

  // Patch traffic from the editors only.
  if (cfg.patchHz > 0) {
    const period = Math.max(1, Math.round(1000 / cfg.patchHz));
    const editors = ready.filter((c) => c.isEditor);
    timers.push(
      setInterval(() => {
        for (const c of editors) {
          // "collection" reproduces today's LWW patch: the whole map on every
          // edit. "entity" models the proposed per-entity patch: just the node
          // that actually moved.
          const id = `node-${(Math.random() * cfg.payloadNodes) | 0}`;
          const patch =
            cfg.patchMode === "entity"
              ? {
                  nodeLayouts: { [id]: { elementId: id, x: Math.random() * 2000, y: Math.random() * 2000 } },
                  __t0: Date.now(),
                }
              : { nodeLayouts: makeNodeLayouts(cfg.payloadNodes), __t0: Date.now() };
          send(c, {
            type: c.isHost ? "host:patch" : "guest:patch",
            roomId: c.roomId,
            patch,
            version: c.knownVersion,
            operationId: `${c.clientId}-${Math.random().toString(36).slice(2, 8)}`,
          });
        }
      }, period),
    );
  }

  setTimeout(() => {
    for (const t of timers) clearInterval(t);
    for (const c of clients) {
      try {
        c.ws.close();
      } catch {
        /* closing a dead socket is fine */
      }
    }
    process.send?.({ t: "done", stats });
    setTimeout(() => process.exit(0), 500);
  }, cfg.durationMs);
}

void main();
