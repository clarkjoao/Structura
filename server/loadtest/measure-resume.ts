/**
 * Measures what a rejoin actually costs, with and without a replay claim.
 *
 * The reconnect replay is only worth its complexity if the frame it saves is
 * large, so this compares the two session:init frames byte for byte on a
 * realistically sized diagram.
 */
import { createServer } from "node:http";
import WebSocket from "ws";
import { attachCollabServer } from "../src/collab.js";

const NODES = Number(process.env.NODES ?? 300);
const EDITS = Number(process.env.EDITS ?? 5);

function makeNodeLayouts(n: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < n; i++) {
    out[`node-${i}`] = { elementId: `node-${i}`, x: i * 3, y: i * 7, width: 180, height: 90 };
  }
  return out;
}

const httpServer = createServer();
await new Promise<void>((r) => httpServer.listen(0, () => r()));
const port = (httpServer.address() as { port: number }).port;
const handle = attachCollabServer(httpServer);

const ROOM = "measure-resume";

function open(): Promise<WebSocket> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.on("open", () => resolve(ws));
  });
}

/** Wait for one frame of the given type, returning it with its byte length. */
function next(ws: WebSocket, type: string): Promise<{ msg: Record<string, unknown>; bytes: number }> {
  return new Promise((resolve) => {
    const onMessage = (raw: WebSocket.RawData): void => {
      const text = String(raw);
      const msg = JSON.parse(text) as Record<string, unknown>;
      if (msg.type === type) {
        ws.off("message", onMessage);
        resolve({ msg, bytes: Buffer.byteLength(text, "utf8") });
      }
    };
    ws.on("message", onMessage);
  });
}

const host = await open();
host.send(
  JSON.stringify({
    type: "host:join",
    protocol: 2,
    roomId: ROOM,
    diagramId: ROOM,
    user: { id: "host", name: "Host", color: "#fff" },
    snapshot: {
      diagramId: ROOM,
      diagramName: "Measured",
      level: "container",
      components: {},
      connections: {},
      flows: {},
      nodeLayouts: makeNodeLayouts(NODES),
      edgeLayouts: {},
      iconLibrary: {},
      scenes: {},
      activeSceneId: null,
      compareSceneId: null,
    },
  }),
);
const ack = await next(host, "host:ack");
const versionAtDrop = ack.msg.version as number;

for (let i = 0; i < EDITS; i++) {
  host.send(
    JSON.stringify({
      type: "host:patch",
      roomId: ROOM,
      patch: { nodeLayouts: { [`node-${i}`]: { elementId: `node-${i}`, x: 999, y: 999 } } },
    }),
  );
  await next(host, "OP_ACK");
}

const fresh = await open();
fresh.send(
  JSON.stringify({
    type: "guest:join",
    protocol: 2,
    roomId: ROOM,
    user: { id: "fresh", name: "Fresh", color: "#fff" },
  }),
);
const freshInit = await next(fresh, "session:init");

const rejoin = await open();
rejoin.send(
  JSON.stringify({
    type: "guest:join",
    protocol: 2,
    resumeFrom: versionAtDrop,
    roomId: ROOM,
    user: { id: "rejoin", name: "Rejoin", color: "#fff" },
  }),
);
const rejoinInit = await next(rejoin, "session:init");

const kb = (b: number): string => (b / 1024).toFixed(1) + "KB";
console.log(`\ndiagrama de ${NODES} nos, ${EDITS} edicoes perdidas durante a queda\n`);
console.log(`  join novo (snapshot):  ${kb(freshInit.bytes)}`);
console.log(`  rejoin (replay):       ${kb(rejoinInit.bytes)}`);
console.log(
  `  reducao:               ${(100 - (rejoinInit.bytes / freshInit.bytes) * 100).toFixed(1)}%  (${(freshInit.bytes / rejoinInit.bytes).toFixed(0)}x menor)\n`,
);
console.log(`  replay traz snapshot?  ${rejoinInit.msg.snapshot !== undefined}`);
console.log(`  operacoes no replay:   ${(rejoinInit.msg.operations as unknown[])?.length}\n`);

host.close();
fresh.close();
rejoin.close();
await handle.shutdown();
await new Promise<void>((r) => httpServer.close(() => r()));
process.exit(0);
