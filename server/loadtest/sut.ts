/**
 * Server Under Test — boots the real collab server in isolation.
 *
 * Deliberately avoids config.ts (dotenv/proxy noise) and express so the
 * measurement reflects the collab relay only. Prints RSS/heap to stderr
 * once per second as JSON lines the driver can parse.
 */
import { createServer } from "node:http";
import { attachCollabServer } from "../src/collab.js";

const PORT = Number(process.env.SUT_PORT ?? 4100);

const httpServer = createServer((_req, res) => {
  res.writeHead(200).end("ok");
});

attachCollabServer(httpServer);

httpServer.listen(PORT, () => {
  process.stderr.write(JSON.stringify({ t: "ready", port: PORT }) + "\n");
});

// Event loop lag sampler: how long a 100ms timer actually takes.
let lagMax = 0;
let lagSum = 0;
let lagCount = 0;
function sampleLag(): void {
  const start = process.hrtime.bigint();
  setTimeout(() => {
    const actual = Number(process.hrtime.bigint() - start) / 1e6;
    const lag = Math.max(0, actual - 100);
    lagMax = Math.max(lagMax, lag);
    lagSum += lag;
    lagCount++;
    sampleLag();
  }, 100).unref();
}
sampleLag();

let peakRss = 0;
let peakHeap = 0;

const sampler = setInterval(() => {
  const m = process.memoryUsage();
  peakRss = Math.max(peakRss, m.rss);
  peakHeap = Math.max(peakHeap, m.heapUsed);
  process.stderr.write(
    JSON.stringify({
      t: "mem",
      rss: m.rss,
      heapUsed: m.heapUsed,
      external: m.external,
      peakRss,
      peakHeap,
      lagAvgMs: Number((lagCount ? lagSum / lagCount : 0).toFixed(2)),
      lagMaxMs: Number(lagMax.toFixed(2)),
    }) + "\n",
  );
}, 1000);
sampler.unref();

// Report a final summary, including event-loop responsiveness, on demand.
process.on("SIGUSR2", () => {
  const m = process.memoryUsage();
  process.stderr.write(
    JSON.stringify({ t: "final", rss: m.rss, heapUsed: m.heapUsed, peakRss, peakHeap }) + "\n",
  );
});

process.on("SIGUSR1", () => {
  process.stderr.write(
    JSON.stringify({
      t: "lag",
      maxMs: Number(lagMax.toFixed(2)),
      avgMs: Number((lagCount ? lagSum / lagCount : 0).toFixed(2)),
      samples: lagCount,
    }) + "\n",
  );
});
