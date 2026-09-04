/**
 * Traces the host's rendering pipeline while other people edit.
 *
 * The sampling profiler reports "idle" during the stalls, which is what it
 * shows when the main thread is busy outside JS. This records the actual
 * timeline — style, layout, paint, composite and JS — and reports where the
 * blocked time goes, both overall and restricted to the long tasks.
 *
 *   node scripts/collab-trace.mjs
 *
 * Env: GUESTS, DURATION_MS, NODES, APP_URL, WS_URL, TOP
 */
import { chromium } from "playwright";

const WS_URL = process.env.WS_URL ?? "ws://localhost:3000/ws";
const GUESTS = Number(process.env.GUESTS ?? 14);
const DURATION_MS = Number(process.env.DURATION_MS ?? 20_000);
const NODES = Number(process.env.NODES ?? 20);
const TOP = Number(process.env.TOP ?? 16);
const STORAGE_KEY = "structura_diagram-store";

async function findAppUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  for (const port of [5273, 8080, 5173]) {
    const base = `http://localhost:${port}`;
    try {
      const res = await fetch(`${base}/`, {
        redirect: "manual",
        signal: AbortSignal.timeout(2000),
      });
      if (res.status >= 300 && res.status < 400) continue;
      if (/<div id="root"|\/src\/main\.tsx/i.test(await res.text())) return base;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

function buildSeed(nodeCount) {
  const diagramId = `collab-trace-${Date.now().toString(36)}`;
  const components = {};
  const nodeLayouts = {};
  const ids = [];
  const perRow = Math.ceil(Math.sqrt(nodeCount));
  for (let i = 0; i < nodeCount; i++) {
    const id = `cmp_${i}`;
    ids.push(id);
    components[id] = { id, name: `Service ${i}`, description: "", parentId: null, type: "system" };
    nodeLayouts[id] = {
      elementId: id,
      x: 120 + (i % perRow) * 260,
      y: 120 + Math.floor(i / perRow) * 200,
      width: 180,
      height: 90,
    };
  }
  const now = new Date().toISOString();
  return {
    diagramId,
    componentIds: ids,
    payload: JSON.stringify({
      state: {
        diagrams: {
          [diagramId]: {
            id: diagramId,
            name: "Trace",
            domain: "",
            level: "context",
            description: "",
            snapshot: { components, connections: {}, flows: {}, iconLibrary: {} },
            nodeLayouts,
            edgeLayouts: {},
            viewport: { x: 0, y: 0, zoom: 0.6 },
            scenes: {},
            createdAt: now,
            updatedAt: now,
          },
        },
        folders: {},
        userTemplates: {},
        serviceRegistry: {},
        activeDiagramId: diagramId,
        past: [],
        future: [],
        _lastUndoRedoAt: 0,
      },
      version: 12,
    }),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const between = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

async function dragNode(page, id, dx, dy) {
  return page
    .evaluate(
      async ({ id, dx, dy }) => {
        const el = document.querySelector(`[data-id="${id}"]`);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const sx = r.left + r.width / 2;
        const sy = r.top + r.height / 2;
        const nap = (ms) => new Promise((res) => setTimeout(res, ms));
        const fire = (t, target, x, y, buttons) =>
          target.dispatchEvent(
            new MouseEvent(t, {
              clientX: x,
              clientY: y,
              button: 0,
              buttons,
              bubbles: true,
              cancelable: true,
              view: window,
            }),
          );
        fire("mousedown", el, sx, sy, 1);
        for (let i = 1; i <= 8; i++) {
          fire("mousemove", window, sx + (dx * i) / 8, sy + (dy * i) / 8, 1);
          await nap(16);
        }
        fire("mouseup", window, sx + dx, sy + dy, 0);
        return true;
      },
      { id, dx, dy },
    )
    .catch(() => false);
}

/** Timeline events worth naming; everything else is folded into "outro". */
const INTERESTING = new Set([
  "FunctionCall",
  "EventDispatch",
  "TimerFire",
  "RunTask",
  "ParseHTML",
  "UpdateLayoutTree",
  "Layout",
  "Paint",
  "PrePaint",
  "Layerize",
  "CompositeLayers",
  "UpdateLayer",
  "UpdateLayerTree",
  "HitTest",
  "ScheduleStyleRecalculation",
  "InvalidateLayout",
  "CommitLoad",
  "MajorGC",
  "MinorGC",
  "GCEvent",
  "V8.GC",
  "RasterTask",
  "DecodeImage",
  "XHRLoad",
]);

async function main() {
  const appUrl = await findAppUrl();
  if (!appUrl) {
    console.error("dev server nao encontrado — rode `npm run dev`");
    process.exit(1);
  }
  const seed = buildSeed(NODES);
  console.log(`\n=== TIMELINE DO HOST (observador) — ${GUESTS} editores ===`);
  console.log(`app ${appUrl} | ${NODES} nos | ${DURATION_MS / 1000}s\n`);

  const browser = await chromium.launch({ headless: true });
  const hostCtx = await browser.newContext({ ignoreHTTPSErrors: true });
  await hostCtx.addInitScript(
    ([k, v]) => window.localStorage.setItem(k, v),
    [STORAGE_KEY, seed.payload],
  );
  const host = await hostCtx.newPage();
  await host.goto(`${appUrl}/model/${seed.diagramId}`, { waitUntil: "domcontentloaded" });
  await host.waitForSelector(".react-flow__node", { timeout: 60_000 });

  await host
    .getByRole("button", { name: /Live session|Sessão ao vivo/i })
    .first()
    .click();
  await host
    .getByPlaceholder(/e\.g\. Alex|ex\.: Alex/i)
    .first()
    .fill("Host");
  const link = await host
    .locator('input[placeholder*="Opens when"], input[placeholder*="Abre"]')
    .first()
    .inputValue();
  await host
    .getByRole("button", { name: /Start session|Iniciar sessão/i })
    .first()
    .click();
  await host.keyboard.press("Escape").catch(() => {});
  await sleep(1000);

  const guests = [];
  for (let i = 1; i <= GUESTS; i++) {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(link, { waitUntil: "domcontentloaded" });
    await page
      .getByPlaceholder(/e\.g\. Alex|ex\.: Alex/i)
      .first()
      .fill(`Guest ${i}`);
    const server = page.locator('input[placeholder*="ws://"]').first();
    if (await server.count()) await server.fill(WS_URL).catch(() => {});
    await page
      .locator('button[title="Test connection"], button[title="Testar conexão"]')
      .first()
      .click();
    await page
      .getByText(/Server online|Servidor no ar/i)
      .first()
      .waitFor({ timeout: 15_000 });
    await page
      .getByRole("button", { name: /^(Join|Entrar)$/i })
      .first()
      .click();
    await page.waitForSelector(".react-flow__node", { timeout: 45_000 });
    guests.push(page);
    process.stdout.write(`\r  entrando: ${i}/${GUESTS}`);
  }
  console.log(`\n  tracando...\n`);

  await host.evaluate(() => {
    window.__stalls = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__stalls.push({ at: e.startTime, ms: e.duration });
    }).observe({ entryTypes: ["longtask"] });
  });

  const cdp = await hostCtx.newCDPSession(host);
  const events = [];
  cdp.on("Tracing.dataCollected", ({ value }) => events.push(...value));

  await cdp.send("Tracing.start", {
    traceConfig: {
      recordMode: "recordAsMuchAsPossible",
      includedCategories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "disabled-by-default-devtools.timeline.frame",
        "blink.user_timing",
        "v8.execute",
      ],
    },
    transferMode: "ReportEvents",
  });
  // Anchor the trace clock to page time: the mark lands in the trace with its
  // own monotonic ts, and we know the performance.now() that produced it.
  const anchorNow = await host.evaluate(() => {
    performance.mark("__trace_anchor");
    return performance.now();
  });

  const deadline = Date.now() + DURATION_MS;
  await Promise.all(
    guests.map(async (page) => {
      while (Date.now() < deadline) {
        await dragNode(page, pick(seed.componentIds), between(-140, 140), between(-110, 110));
        await sleep(between(150, 500));
      }
    }),
  );

  const done = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
  await cdp.send("Tracing.end");
  await done;

  const stalls = await host.evaluate(() => window.__stalls);
  const blocked = stalls.reduce((a, s) => a + s.ms, 0);

  const anchorEvent = events.find(
    (e) => e.name === "__trace_anchor" || e.args?.data?.name === "__trace_anchor",
  );
  if (!anchorEvent) {
    console.error("ancora nao encontrada no trace — nao da para alinhar os relogios");
    await browser.close();
    process.exit(1);
  }
  const mainThread = `${anchorEvent.pid}:${anchorEvent.tid}`;
  const traceToPage = (ts) => anchorNow + (ts - anchorEvent.ts) / 1000;
  const inStall = (ms) => stalls.some((s) => ms >= s.at && ms <= s.at + s.ms);

  // X events nest on a thread, so raw durations double-count. Walk them in
  // order keeping a stack and charge each event only its own time.
  const main = events
    .filter((e) => e.ph === "X" && e.dur && `${e.pid}:${e.tid}` === mainThread)
    .sort((a, b) => a.ts - b.ts || b.dur - a.dur);

  const overall = new Map();
  const during = new Map();
  let overallUs = 0;
  let duringUs = 0;
  const stack = [];

  // Which JS ran during the stalls, by name.
  const callers = new Map();
  let callerUs = 0;

  const charge = (event, us) => {
    if (us <= 0) return;
    const name = INTERESTING.has(event.name) ? event.name : "outro";
    overall.set(name, (overall.get(name) ?? 0) + us);
    overallUs += us;
    if (inStall(traceToPage(event.ts))) {
      during.set(name, (during.get(name) ?? 0) + us);
      duringUs += us;
      const d = event.args?.data;
      if (event.name === "FunctionCall" && d) {
        const file = (d.url ?? "").split("/").slice(-1)[0].split("?")[0];
        const key = `${d.functionName || "(anonymous)"}${file ? ` — ${file}:${d.lineNumber ?? "?"}` : ""}`;
        callers.set(key, (callers.get(key) ?? 0) + us);
        callerUs += us;
      }
    }
  };

  for (const e of main) {
    while (stack.length && stack[stack.length - 1].end <= e.ts) {
      const done = stack.pop();
      charge(done.event, done.self);
    }
    if (stack.length) stack[stack.length - 1].self -= e.dur;
    stack.push({ event: e, end: e.ts + e.dur, self: e.dur });
  }
  while (stack.length) {
    const done = stack.pop();
    charge(done.event, done.self);
  }

  const table = (map, totalUs, header) => {
    console.log(header);
    console.log("evento".padEnd(30) + "ms".padStart(9) + "%".padStart(8));
    console.log("-".repeat(47));
    for (const [name, us] of [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP)) {
      console.log(
        name.slice(0, 28).padEnd(30) +
          (us / 1000).toFixed(0).padStart(9) +
          (totalUs ? ((us / totalUs) * 100).toFixed(1) : "0").padStart(7) +
          "%",
      );
    }
    console.log("");
  };

  console.log(`long tasks: ${stalls.length} | bloqueado: ${Math.round(blocked)}ms\n`);
  table(overall, overallUs, "=== TIMELINE INTEIRA ===");
  if (duringUs === 0) {
    console.log("=== DENTRO DAS LONG TASKS ===\nnenhum evento casou com as janelas\n");
  } else {
    table(during, duringUs, `=== DENTRO DAS LONG TASKS (${Math.round(blocked)}ms) ===`);
    if (callerUs > 0) {
      console.log("=== QUAL JS, DENTRO DAS LONG TASKS ===");
      console.log("entrada".padEnd(46) + "ms".padStart(8) + "%".padStart(8));
      console.log("-".repeat(62));
      for (const [name, us] of [...callers.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP)) {
        console.log(
          name.slice(0, 44).padEnd(46) +
            (us / 1000).toFixed(0).padStart(8) +
            ((us / callerUs) * 100).toFixed(1).padStart(7) +
            "%",
        );
      }
      console.log("");
    }
  }

  await browser.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
