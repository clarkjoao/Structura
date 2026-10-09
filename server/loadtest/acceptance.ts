/**
 * Acceptance run for live collaboration (collab-relay spec): load, convergence and resilience
 * against the multi-relay stack.
 *
 *   docker compose -f ../deploy/compose/docker-compose.yml up --build -d
 *   npx tsx loadtest/acceptance.ts                       # every scenario
 *   SCENARIOS=load npx tsx loadtest/acceptance.ts
 *
 * Scenarios
 *   load          500 participants in 35 rooms; 3 rooms of 50 with 20 dragging at 10 Hz
 *   kill-relay    the same load, and a relay is killed mid-run
 *   redis-restart the same load, and Redis restarts with no persistence
 *   host-drop     a host vanishes: its room keeps working, then closes after the grace period
 *
 * Asserted: fan-out p95 < 150 ms; zero participants whose state differs from a fresh joiner's;
 * everyone editing again within 5 s of a relay kill; rooms back after a Redis restart.
 * Exits non-zero on any miss and prints the measurements.
 *
 * Env: WS_URL, COMPOSE_FILE, TOTAL (500), ROOMS (35), BIG_ROOMS (3), BIG_SIZE (50),
 * BIG_DRAGGERS (20), DRAG_HZ (10), SMALL_EDITORS (3), SMALL_HZ (2), NODES (100),
 * DURATION_MS (30000), SCENARIOS (load,kill-relay,redis-restart,host-drop), HOST_GRACE_MS (30000),
 * KILL_RELAY_CMD / RESTART_REDIS_CMD (shell commands replacing the compose ones, e.g. kubectl).
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeDiagram } from "./fixtures.js";
import { canonical, Participant } from "./participant.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = (key: string, fallback: number) => Number(process.env[key] ?? fallback);

const WS_URL = process.env.WS_URL ?? "ws://localhost:3000/ws";
const COMPOSE_FILE =
  process.env.COMPOSE_FILE ?? path.resolve(here, "../../deploy/compose/docker-compose.yml");
const TOTAL = env("TOTAL", 500);
const ROOMS = env("ROOMS", 35);
const BIG_ROOMS = env("BIG_ROOMS", 3);
const BIG_SIZE = env("BIG_SIZE", 50);
const BIG_DRAGGERS = env("BIG_DRAGGERS", 20);
const DRAG_HZ = env("DRAG_HZ", 10);
const SMALL_EDITORS = env("SMALL_EDITORS", 3);
const SMALL_HZ = env("SMALL_HZ", 2);
const NODES = env("NODES", 100);
const DURATION_MS = env("DURATION_MS", 30_000);
const HOST_GRACE_MS = env("HOST_GRACE_MS", 30_000);
const SCENARIOS = (process.env.SCENARIOS ?? "load,kill-relay,redis-restart,host-drop").split(",");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const failures: string[] = [];
function check(ok: boolean, message: string): void {
  if (!ok) failures.push(message);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${message}`);
}
function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
function compose(...args: string[]): void {
  execFileSync("docker", ["compose", "-f", COMPOSE_FILE, ...args], { stdio: "ignore" });
}

/** How to kill one relay and restart Redis: compose by default, overridable (kind, a cluster). */
function killRelay(): void {
  if (process.env.KILL_RELAY_CMD)
    execFileSync("sh", ["-c", process.env.KILL_RELAY_CMD], { stdio: "ignore" });
  else compose("kill", "relay-2");
}
function reviveRelay(): void {
  if (!process.env.KILL_RELAY_CMD) compose("start", "relay-2");
}
function restartRedis(): void {
  if (process.env.RESTART_REDIS_CMD)
    execFileSync("sh", ["-c", process.env.RESTART_REDIS_CMD], { stdio: "ignore" });
  else compose("restart", "redis");
}

interface Room {
  id: string;
  members: Participant[];
  editors: Participant[];
  hz: number;
}

const latencies: number[] = [];
let measuring = false;

function user(name: string) {
  return { id: `${name}-${randomUUID().slice(0, 8)}`, name, color: "#336699" };
}

async function inBatches<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

async function buildRooms(): Promise<Room[]> {
  const smallRooms = ROOMS - BIG_ROOMS;
  const smallTotal = TOTAL - BIG_ROOMS * BIG_SIZE;
  const sizes = [
    ...Array.from({ length: BIG_ROOMS }, () => BIG_SIZE),
    ...Array.from(
      { length: smallRooms },
      (_, i) => Math.floor(smallTotal / smallRooms) + (i < smallTotal % smallRooms ? 1 : 0),
    ),
  ];
  const onEntry = (entry: { opId: string; sender: string }, at: number, self: string) => {
    if (!measuring || entry.sender === self) return;
    const sentAt = Number(entry.opId.split("|")[1]);
    if (Number.isFinite(sentAt)) latencies.push(Date.now() - sentAt + (at - performance.now()));
  };

  const rooms: Room[] = [];
  await inBatches(
    sizes.map((size, index) => ({ size, index })),
    10,
    async ({ size, index }) => {
      const roomId = randomUUID();
      const host = new Participant({
        url: WS_URL,
        roomId,
        user: user(`host${index}`),
        role: "host",
        seed: makeDiagram(NODES, `load-${index}`),
      });
      await host.start();
      const members = [host];
      for (let g = 1; g < size; g++) {
        const p: Participant = new Participant({
          url: WS_URL,
          roomId,
          user: user(`r${index}g${g}`),
          role: "guest",
          onEntry: (entry, at) => onEntry(entry, at, p.id),
        });
        members.push(p);
      }
      await inBatches(members.slice(1), 25, (p) => p.start());
      const big = index < BIG_ROOMS;
      rooms.push({
        id: roomId,
        members,
        editors: members.slice(0, big ? BIG_DRAGGERS : Math.min(SMALL_EDITORS, members.length)),
        hz: big ? DRAG_HZ : SMALL_HZ,
      });
    },
  );
  return rooms;
}

/** Every editor moves a random node at its rate until `stop` resolves. */
function edit(rooms: Room[], durationMs: number): Promise<number> {
  let sent = 0;
  const timers: Array<ReturnType<typeof setInterval>> = [];
  for (const room of rooms) {
    for (const editor of room.editors) {
      const startIn = Math.random() * (1000 / room.hz);
      setTimeout(() => {
        timers.push(
          setInterval(() => {
            const n = Math.floor(Math.random() * NODES);
            const ok = editor.patch({
              entities: {
                nodeLayouts: {
                  [`cmp_${n}`]: {
                    set: {
                      x: Math.round(Math.random() * 2000),
                      y: Math.round(Math.random() * 1500),
                    },
                  },
                },
              },
            });
            if (ok) sent += 1;
          }, 1000 / room.hz),
        );
      }, startIn);
    }
  }
  return sleep(durationMs).then(() => {
    for (const t of timers) clearInterval(t);
    return sent;
  });
}

/** Wait for quiet, then compare every member with what a fresh joiner receives. */
async function convergence(rooms: Room[], label: string): Promise<void> {
  await sleep(4000);
  let divergent = 0;
  let notReady = 0;
  for (const room of rooms) {
    // A full room has no seat for the witness: free the last one first.
    const leaving = room.members.pop();
    leaving?.close();
    await sleep(200);
    const witness = new Participant({
      url: WS_URL,
      roomId: room.id,
      user: user("witness"),
      role: "guest",
    });
    await witness.start();
    const truth = canonical(witness.state);
    for (const member of room.members) {
      if (!member.ready) notReady += 1;
      else if (canonical(member.state) !== truth) divergent += 1;
    }
    witness.close();
  }
  const members = rooms.reduce((n, r) => n + r.members.length, 0);
  check(notReady === 0, `${label}: every participant is connected and ready (${notReady} not)`);
  check(divergent === 0, `${label}: ${divergent} of ${members} participants diverge from the room`);
}

function report(label: string, sent: number): void {
  const sorted = [...latencies].sort((a, b) => a - b);
  console.log(
    `  ${label}: ${sent} edits sent, ${sorted.length} deliveries measured; fan-out p50 ${pct(sorted, 50)} ms, p95 ${pct(sorted, 95)} ms, p99 ${pct(sorted, 99)} ms`,
  );
  check(sorted.length > 0 && pct(sorted, 95) < 150, `${label}: fan-out p95 < 150 ms`);
}

function teardown(rooms: Room[]): void {
  for (const room of rooms) for (const m of room.members) m.close();
}

async function loadScenario(
  name: string,
  during?: (rooms: Room[]) => Promise<void>,
): Promise<void> {
  console.log(`\n=== ${name} ===`);
  latencies.length = 0;
  const t0 = Date.now();
  const rooms = await buildRooms();
  const count = rooms.reduce((n, r) => n + r.members.length, 0);
  console.log(`  ${count} participants in ${rooms.length} rooms, joined in ${Date.now() - t0} ms`);
  measuring = true;
  const editing = edit(rooms, DURATION_MS);
  if (during) await during(rooms);
  const sent = await editing;
  measuring = false;
  report(name, sent);
  await convergence(rooms, name);
  teardown(rooms);
  await sleep(1000);
}

async function hostDropScenario(): Promise<void> {
  console.log("\n=== host-drop ===");
  const roomId = randomUUID();
  const host = new Participant({
    url: WS_URL,
    roomId,
    user: user("host"),
    role: "host",
    seed: makeDiagram(20),
  });
  await host.start();
  const guests = Array.from(
    { length: 5 },
    (_, i) => new Participant({ url: WS_URL, roomId, user: user(`g${i}`), role: "guest" }),
  );
  await Promise.all(guests.map((g) => g.start()));
  host.vanish();
  await sleep(1000);
  const before = guests[0].acked;
  guests[0].patch({ entities: { nodeLayouts: { cmp_1: { set: { x: 4242 } } } } });
  await sleep(1000);
  check(
    guests[0].acked === before + 1,
    "host-drop: the room keeps accepting edits while the host is away",
  );
  check(
    guests.every((g) => g.ended === null),
    "host-drop: nobody is closed during the grace period",
  );
  const deadline = Date.now() + HOST_GRACE_MS + 10_000;
  while (Date.now() < deadline && !guests.every((g) => g.ended !== null)) await sleep(500);
  check(
    guests.every((g) => g.ended === "host_timeout"),
    `host-drop: after the grace period every guest is told (${guests.map((g) => g.ended).join(",")})`,
  );
  for (const g of guests) g.close();
}

for (const scenario of SCENARIOS) {
  if (scenario === "load") await loadScenario("load");
  if (scenario === "kill-relay") {
    await loadScenario("kill-relay", async (rooms) => {
      await sleep(DURATION_MS / 3);
      const before = new Map(rooms.flatMap((r) => r.members).map((m) => [m, m.outagesMs.length]));
      console.log("  killing a relay");
      killRelay();
      await sleep(8000);
      const outages = [...before].flatMap(([m, n]) => m.outagesMs.slice(n));
      const worst = Math.max(0, ...outages);
      console.log(`  ${outages.length} participants reconnected; worst outage ${worst} ms`);
      check(outages.length > 0, "kill-relay: the relay's participants were actually cut");
      check(worst <= 5000, "kill-relay: everyone editing again within 5 s");
      reviveRelay();
    });
  }
  if (scenario === "redis-restart") {
    await loadScenario("redis-restart", async (rooms) => {
      await sleep(DURATION_MS / 3);
      console.log("  restarting redis (no persistence)");
      restartRedis();
      const deadline = Date.now() + 20_000;
      const everyone = rooms.flatMap((r) => r.members);
      await sleep(3000);
      while (Date.now() < deadline && !everyone.every((m) => m.ready)) await sleep(250);
      check(
        everyone.every((m) => m.ready),
        "redis-restart: every room is back (hosts reseeded)",
      );
    });
  }
  if (scenario === "host-drop") await hostDropScenario();
}

console.log(`\n${failures.length === 0 ? "PASS" : `FAIL (${failures.length})`}`);
for (const f of failures) console.log(`  - ${f}`);
process.exit(failures.length === 0 ? 0 : 1);
