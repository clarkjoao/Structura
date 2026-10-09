/**
 * Large-diagram transfer: seed a 1,000-node diagram and time a guest's join, end to end over
 * WebSockets; then time the Redis seed commit on its own.
 *
 *   docker compose -f ../deploy/compose/docker-compose.yml up -d   # relays on :3000
 *   REDIS_URL=redis://localhost:6390 npx tsx loadtest/large-diagram.ts
 *
 * Env: WS_URL (ws://localhost:3000/ws), NODES (1000), REDIS_URL (optional, for the commit timing).
 * Targets (collab-sync spec): join < 3 s; seed commit < 20 ms of Redis time.
 */
import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";
import { RedisRoomStore } from "../src/collab/store/redis.js";
import { chunkString } from "../src/collab/protocol.js";
import { Probe } from "./client.js";
import { makeDiagram } from "./fixtures.js";

const WS_URL = process.env.WS_URL ?? "ws://localhost:3000/ws";
const NODES = Number(process.env.NODES ?? 1000);
const REDIS_URL = process.env.REDIS_URL;

/** Key-order-independent JSON: Redis returns hash fields and set members in its own order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : v,
  );
}

const user = (name: string) => ({ id: `${name}-${randomUUID().slice(0, 8)}`, name, color: "#123" });

async function overWebSocket(): Promise<boolean> {
  const seed = makeDiagram(NODES);
  const bytes = JSON.stringify(seed).length;
  const roomId = randomUUID();
  console.log(`diagram: ${NODES} nodes, ${(bytes / 1024 / 1024).toFixed(2)} MB serialised`);

  const host = new Probe({ url: WS_URL, roomId, user: user("host") });
  await host.connect();
  let t = performance.now();
  await host.host(seed);
  const seedMs = performance.now() - t;

  const guest = new Probe({ url: WS_URL, roomId, user: user("guest") });
  await guest.connect();
  t = performance.now();
  await guest.join();
  const joinMs = performance.now() - t;
  const identical = canonical(guest.state) === canonical(seed);
  host.send({ type: "close" });
  host.close();
  guest.close();

  console.log(`seed (create → joined):   ${seedMs.toFixed(0)} ms`);
  console.log(`join (join → snapshot):   ${joinMs.toFixed(0)} ms   target < 3000`);
  console.log(`guest state identical:    ${identical}`);
  return joinMs < 3000 && identical;
}

async function redisCommit(): Promise<boolean> {
  if (!REDIS_URL) {
    console.log("redis commit: skipped (set REDIS_URL)");
    return true;
  }
  const admin = new Redis(REDIS_URL);
  const store = new RedisRoomStore(REDIS_URL, { namespace: "measure:" });
  const roomId = randomUUID();
  const chunks = chunkString(JSON.stringify(makeDiagram(NODES)));
  await store.createRoom({
    roomId,
    hostTokenHash: "x",
    hostUser: user("h"),
    seedChunks: chunks.length,
    now: Date.now(),
  });
  for (const [i, data] of chunks.entries()) await store.appendSeedChunk(roomId, i, data);

  // Commands run inside a script are logged too, so make room for all of them.
  const [, maxLen] = (await admin.config("GET", "slowlog-max-len")) as [string, string];
  await admin.config("SET", "slowlog-max-len", "100000");
  await admin.config("SET", "slowlog-log-slower-than", "0");
  await admin.slowlog("RESET");
  const t = performance.now();
  const result = await store.commitSeed(roomId);
  const wallMs = performance.now() - t;
  const log = (await admin.slowlog("GET", 100000)) as Array<[number, number, number, string[]]>;
  const evals = log.filter(([, , , args]) => /^EVAL/i.test(String(args[0])));
  // The commit runs as several short calls; the target bounds the longest single one.
  const scriptMs = Math.max(0, ...evals.map(([, , micros]) => micros / 1000));
  const totalMs = evals.reduce((sum, [, , micros]) => sum + micros / 1000, 0);
  await admin.config("SET", "slowlog-log-slower-than", "10000");
  await admin.config("SET", "slowlog-max-len", maxLen);
  await store.discardRoom(roomId);
  await store.close();
  admin.disconnect();

  console.log(
    `seed commit: ok=${result.ok}, wall ${wallMs.toFixed(0)} ms, longest Redis call ${scriptMs.toFixed(1)} ms (all calls ${totalMs.toFixed(1)} ms over ${evals.length})   target < 20`,
  );
  return result.ok && scriptMs < 20;
}

const okWs = await overWebSocket();
const okRedis = await redisCommit();
console.log(okWs && okRedis ? "\nPASS" : "\nFAIL");
process.exit(okWs && okRedis ? 0 : 1);
