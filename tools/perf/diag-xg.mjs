import { chromium } from "/Users/clark/www/Structura/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync } from "node:fs"; import { homedir } from "node:os"; import { join } from "node:path";
const FIX = join(homedir(), "structura-scratch/build-nodes/fixtures");
const APP = "http://localhost:8199"; const KEY = "structura_diagram-store";
const FIXTURE = process.argv[2] ?? "XG";
const BUDGET_MS = Number(process.argv[3] ?? 150000);
const browser = await chromium.launch({ headless: false, args: ["--disable-background-timer-throttling"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
const errs = new Map();
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") { const k = m.text().slice(0, 120); errs.set(k, (errs.get(k) ?? 0) + 1); } });
page.on("pageerror", (e) => { const k = "PAGEERROR " + String(e.message).slice(0, 120); errs.set(k, (errs.get(k) ?? 0) + 1); });
page.on("crash", () => console.log("!!! PAGE CRASHED"));

const payload = readFileSync(join(FIX, `${FIXTURE}.json`), "utf8");
const parsed = JSON.parse(payload);
const id = parsed.state.activeDiagramId;
console.log(`${FIXTURE}: payload ${(payload.length / 1e6).toFixed(2)} MB, diagram ${id}`);
await page.goto(APP, { waitUntil: "domcontentloaded" });
const wrote = await page.evaluate(({ k, p }) => {
  localStorage.clear();
  const t = performance.now();
  try { localStorage.setItem(k, p); } catch (e) { return { ok: false, err: String(e).slice(0, 120) }; }
  return { ok: true, ms: +(performance.now() - t).toFixed(1), bytes: p.length };
}, { k: KEY, p: payload });
console.log("localStorage seed:", wrote);
if (!wrote.ok) { await browser.close(); process.exit(1); }

const t0 = Date.now();
await cdp.send("Profiler.start");
page.goto(`${APP}/model/${id}`, { waitUntil: "commit", timeout: BUDGET_MS }).catch((e) => console.log("goto:", String(e).slice(0, 80)));
const samples = [];
while (Date.now() - t0 < BUDGET_MS) {
  await new Promise((r) => setTimeout(r, 10000));
  let s;
  try {
    s = await Promise.race([
      page.evaluate(() => ({
        url: location.pathname,
        rf: !!document.querySelector(".react-flow"),
        nodes: document.querySelectorAll(".react-flow__node").length,
        edges: document.querySelectorAll(".react-flow__edge").length,
        root: document.getElementById("root")?.children.length ?? -1,
        bodyText: (document.body.innerText || "").slice(0, 60).replace(/\s+/g, " "),
      })),
      new Promise((_, rej) => setTimeout(() => rej(new Error("evaluate blocked >8s")), 8000)),
    ]);
  } catch (e) { s = { blocked: String(e.message) }; }
  const el = Math.round((Date.now() - t0) / 1000);
  console.log(`  t+${el}s`, JSON.stringify(s));
  samples.push({ t: el, ...s });
  if (s.nodes > 0) { console.log("  -> nodes rendered"); break; }
}
const { profile } = await cdp.send("Profiler.stop");
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map(); let idle = 0, program = 0;
for (let i = 0; i < profile.samples.length; i++) {
  const n = byId.get(profile.samples[i]); if (!n) continue;
  const dt = (profile.timeDeltas[i] ?? 0) / 1000; const fn = n.callFrame.functionName;
  if (fn === "(idle)") { idle += dt; continue; } if (fn === "(program)") { program += dt; continue; }
  const k = `${fn || "(anon)"}@${(n.callFrame.url || "").split("/").pop()}:${n.callFrame.lineNumber + 1}`;
  self.set(k, (self.get(k) ?? 0) + dt);
}
console.log(`\nCPU over ${Math.round((Date.now() - t0) / 1000)}s: idle=${(idle / 1000).toFixed(1)}s program=${(program / 1000).toFixed(1)}s`);
for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${(v / 1000).toFixed(2)}s  ${k}`);
console.log("\nconsole errors/warnings:");
for (const [k, v] of [...errs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${v}x ${k}`);
writeFileSync(join(homedir(), `structura-scratch/build-nodes/raw/diag-${FIXTURE}.json`), JSON.stringify({ samples, errs: [...errs] }, null, 2));
await browser.close();
