/**
 * Load test orchestrator.
 *
 * Boots the server under test in its own process, shards the client load
 * across N worker processes, aggregates the results and prints a report.
 *
 *   npx tsx loadtest/driver.ts
 *
 * Env knobs: ROOMS, PER_ROOM, EDITORS, MOUSEMOVE_HZ, CURSOR_HZ, PATCH_HZ,
 * PAYLOAD_NODES, DURATION_MS, WORKERS, LABEL
 */
import { fork, spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

const ROOMS = Number(process.env.ROOMS ?? 50);
const PER_ROOM = Number(process.env.PER_ROOM ?? 15);
const EDITORS = Number(process.env.EDITORS ?? 4);
const MOUSEMOVE_HZ = Number(process.env.MOUSEMOVE_HZ ?? 60);
const CURSOR_HZ = Number(process.env.CURSOR_HZ ?? 30);
const PATCH_HZ = Number(process.env.PATCH_HZ ?? 2);
const PAYLOAD_NODES = Number(process.env.PAYLOAD_NODES ?? 100);
const DURATION_MS = Number(process.env.DURATION_MS ?? 20_000);
const WORKERS = Number(process.env.WORKERS ?? 5);
const PATCH_MODE = (process.env.PATCH_MODE ?? "collection") as "collection" | "entity";
const LABEL = process.env.LABEL ?? "baseline";
const PORT = Number(process.env.SUT_PORT ?? 4100);

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

const mb = (b: number): string => (b / 1024 / 1024).toFixed(0) + "MB";

async function main(): Promise<void> {
  console.log(`\n=== LOAD TEST: ${LABEL} ===`);
  console.log(
    `${ROOMS} rooms x ${PER_ROOM} clients = ${ROOMS * PER_ROOM} connections | ` +
      `${EDITORS} editors/room | payload ${PAYLOAD_NODES} nodes | patch=${PATCH_MODE}`,
  );
  console.log(
    `traffic/client: activeElement ${MOUSEMOVE_HZ}Hz, cursor ${CURSOR_HZ}Hz, patch ${PATCH_HZ}Hz | ${DURATION_MS / 1000}s\n`,
  );

  // --- boot server under test -------------------------------------------
  const sut: ChildProcess = spawn(
    "npx",
    ["tsx", path.join(here, "sut.ts")],
    { env: { ...process.env, SUT_PORT: String(PORT) }, stdio: ["ignore", "ignore", "pipe"] },
  );

  let peakRss = 0;
  let peakHeap = 0;
  let lastRss = 0;
  interface Lag { maxMs: number; avgMs: number }
  let lagReport: Lag | null = null;
  let ready = false;

  sut.stderr!.setEncoding("utf8");
  let buf = "";
  sut.stderr!.on("data", (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (!line.startsWith("{")) continue;
      try {
        const m = JSON.parse(line);
        if (m.t === "ready") ready = true;
        if (m.t === "mem") {
          peakRss = Math.max(peakRss, m.peakRss);
          peakHeap = Math.max(peakHeap, m.peakHeap);
          lastRss = m.rss;
          lagReport = { maxMs: m.lagMaxMs, avgMs: m.lagAvgMs };
        }
        if (m.t === "lag") lagReport = { maxMs: m.maxMs, avgMs: m.avgMs };
      } catch {
        /* non-JSON server log line */
      }
    }
  });

  const t0 = Date.now();
  while (!ready && Date.now() - t0 < 30_000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) {
    console.error("server under test failed to start");
    sut.kill("SIGKILL");
    process.exit(1);
  }

  // --- shard rooms across workers ---------------------------------------
  const perWorker = Math.ceil(ROOMS / WORKERS);
  const workers: ChildProcess[] = [];
  const results: Array<Record<string, unknown>> = [];
  let connectedTotal = 0;
  let failedTotal = 0;

  const connectStart = Date.now();

  const doneWaits = Array.from({ length: WORKERS }, (_, i) => {
    const roomStart = i * perWorker;
    const roomEnd = Math.min(ROOMS, roomStart + perWorker);
    if (roomStart >= roomEnd) return Promise.resolve();

    const cfg = {
      url: `ws://127.0.0.1:${PORT}/ws`,
      roomStart,
      roomEnd,
      perRoom: PER_ROOM,
      editorsPerRoom: EDITORS,
      mousemoveHz: MOUSEMOVE_HZ,
      cursorHz: CURSOR_HZ,
      patchHz: PATCH_HZ,
      payloadNodes: PAYLOAD_NODES,
      durationMs: DURATION_MS,
      patchMode: PATCH_MODE,
    };

    const w = fork(path.join(here, "worker.ts"), {
      execArgv: ["--import", "tsx"],
      env: { ...process.env, LT_CFG: JSON.stringify(cfg) },
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    workers.push(w);

    return new Promise<void>((resolve) => {
      w.on("message", (m: Record<string, unknown>) => {
        if (m.t === "connected") {
          connectedTotal += Number(m.connected);
          failedTotal += Number(m.failed);
          if (connectedTotal + failedTotal >= ROOMS * PER_ROOM) {
            console.log(
              `connected ${connectedTotal}/${ROOMS * PER_ROOM} in ${((Date.now() - connectStart) / 1000).toFixed(1)}s` +
                (failedTotal ? `  (${failedTotal} FAILED)` : ""),
            );
          }
        }
        if (m.t === "done") {
          results.push(m.stats as Record<string, unknown>);
          resolve();
        }
      });
      w.on("exit", () => resolve());
    });
  });

  await Promise.all(doneWaits);

  await new Promise((r) => setTimeout(r, 300));

  // --- aggregate ---------------------------------------------------------
  let sent = 0;
  let received = 0;
  let bytesSent = 0;
  let sendErrors = 0;
  const allLat: number[] = [];
  const allPatchLat: number[] = [];
  const errors: Record<string, number> = {};

  for (const r of results) {
    sent += Number(r.sent ?? 0);
    received += Number(r.received ?? 0);
    bytesSent += Number(r.bytesSent ?? 0);
    sendErrors += Number(r.sendErrors ?? 0);
    for (const l of (r.latencies as number[]) ?? []) allLat.push(l);
    for (const l of (r.patchLatencies as number[]) ?? []) allPatchLat.push(l);
    for (const [k, v] of Object.entries((r.errors as Record<string, number>) ?? {})) {
      errors[k] = (errors[k] ?? 0) + Number(v);
    }
  }

  allLat.sort((a, b) => a - b);
  allPatchLat.sort((a, b) => a - b);
  const secs = DURATION_MS / 1000;

  console.log(`\n--- RESULT: ${LABEL} ---`);
  console.log(`connections     ${connectedTotal}/${ROOMS * PER_ROOM}  failed=${failedTotal}`);
  console.log(`msgs sent       ${sent}  (${Math.round(sent / secs)}/s)  ${mb(bytesSent)} total`);
  console.log(`msgs received   ${received}  (${Math.round(received / secs)}/s)`);
  console.log(
    `cursor latency  p50=${pct(allLat, 50)}ms  p95=${pct(allLat, 95)}ms  p99=${pct(allLat, 99)}ms  max=${allLat[allLat.length - 1] ?? 0}ms  (n=${allLat.length})`,
  );
  console.log(
    `patch latency   p50=${pct(allPatchLat, 50)}ms  p95=${pct(allPatchLat, 95)}ms  p99=${pct(allPatchLat, 99)}ms  max=${allPatchLat[allPatchLat.length - 1] ?? 0}ms  (n=${allPatchLat.length})`,
  );
  console.log(`server memory   peakRSS=${mb(peakRss)}  peakHeap=${mb(peakHeap)}  endRSS=${mb(lastRss)}`);
  const lag = lagReport as Lag | null;
  if (lag) {
    console.log(`server loop lag avg=${lag.avgMs}ms  max=${lag.maxMs}ms`);
  }
  console.log(`errors          ${Object.keys(errors).length ? JSON.stringify(errors) : "none"}`);
  if (sendErrors) console.log(`client send err ${sendErrors}`);
  console.log("");

  for (const w of workers) w.kill("SIGKILL");
  sut.kill("SIGKILL");
  process.exit(0);
}

void main();
