/**
 * Canvas render profiler — where does a drag frame actually go?
 *
 * Runs one browser against a *production* build (dev inflates blocked time ~5x)
 * and samples the CPU while a node is dragged, so the answer is attributed to
 * named functions instead of guessed from the source.
 *
 *   npx vite build --minify false --outDir dist-prof   # names survive
 *   npx vite preview --outDir dist-prof --port 4173
 *   node scripts/canvas-render-profile.mjs
 *
 * Env: APP_URL, NODES, DRAG_STEPS, HEADED, LABEL
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const APP_URL = process.env.APP_URL ?? "http://localhost:4173";
const NODES = Number(process.env.NODES ?? 150);
const DRAG_STEPS = Number(process.env.DRAG_STEPS ?? 240);
const HEADED = process.env.HEADED !== "0";
const LABEL = process.env.LABEL ?? "run";
/**
 * "local"  — this browser drags a node, and we measure this browser.
 * "remote" — a guest drags in a live session and we measure the *host*, which
 *            is the collaboration receive path: patch -> store -> canvas render.
 *            Both pages run headless so neither is a throttled background tab.
 */
const MODE = process.env.MODE ?? "local";
const WS_URL = process.env.WS_URL ?? "ws://localhost:3000/ws";

const STORAGE_KEY = "structura_diagram-store";
const PERSIST_VERSION = 12;

function buildSeed(nodeCount) {
  const diagramId = `render-prof-${Date.now().toString(36)}`;
  const components = {};
  const nodeLayouts = {};
  const connections = {};
  const ids = [];
  const perRow = Math.ceil(Math.sqrt(nodeCount));

  for (let i = 0; i < nodeCount; i++) {
    const id = `cmp_${i}`;
    ids.push(id);
    components[id] = {
      id,
      name: `Service ${i}`,
      description: `Seeded component ${i}`,
      parentId: null,
      type: "system",
    };
    nodeLayouts[id] = {
      elementId: id,
      x: 120 + (i % perRow) * 260,
      y: 120 + Math.floor(i / perRow) * 200,
      width: 180,
      height: 90,
    };
  }
  for (let i = 0; i + 1 < ids.length; i += 3) {
    const connId = `conn_${i}`;
    connections[connId] = {
      id: connId,
      sourceId: ids[i],
      targetId: ids[i + 1],
      label: "uses",
      style: {},
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
            name: `Render profile — ${nodeCount} nós`,
            domain: "",
            level: "context",
            description: "Diagrama semeado para o profile de renderização",
            snapshot: { components, connections, flows: {}, iconLibrary: {} },
            nodeLayouts,
            edgeLayouts: {},
            viewport: { x: 0, y: 0, zoom: 0.5 },
            scenes: {},
            activeSceneId: undefined,
            compareSceneId: undefined,
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
      version: PERSIST_VERSION,
    }),
  };
}

/**
 * Who calls the hot functions.
 *
 * Flat self time says a comparison is expensive; it does not say which selector
 * asked for it. The sampling profile is a tree, so walk up from every hot leaf
 * and attribute its self time to the nearest caller in our own source.
 */
function callersOf(profile, matcher, depth = 8) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const node of profile.nodes) {
    for (const child of node.children ?? []) parent.set(child, node.id);
  }

  const deltas = profile.timeDeltas ?? [];
  const chains = new Map();
  profile.samples.forEach((sampleId, index) => {
    const dt = (deltas[index] ?? 0) / 1000;
    if (dt <= 0) return;
    const leaf = byId.get(sampleId);
    if (!leaf || !matcher(leaf.callFrame)) return;

    const chain = [];
    let current = parent.get(sampleId);
    while (current !== undefined && chain.length < depth) {
      const node = byId.get(current);
      if (!node) break;
      const frame = node.callFrame;
      chain.push(
        `${frame.functionName || "(anonymous)"}@${
          frame.url ? `${frame.url.split("/").pop()}:${frame.lineNumber + 1}` : "?"
        }`,
      );
      current = parent.get(current);
    }
    const key = chain.join(" < ") || "(root)";
    chains.set(key, (chains.get(key) ?? 0) + dt);
  });

  return [...chains.entries()].sort((a, b) => b[1] - a[1]);
}

/** Self time per function, from a CDP sampling profile. */
function selfTimeByFunction(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const hits = new Map();
  let total = 0;

  const deltas = profile.timeDeltas ?? [];
  profile.samples.forEach((sampleId, index) => {
    const dt = (deltas[index] ?? 0) / 1000; // µs -> ms
    if (dt <= 0) return;
    total += dt;
    const node = byId.get(sampleId);
    if (!node) return;
    const frame = node.callFrame;
    const name = frame.functionName || "(anonymous)";
    const where = frame.url ? `${frame.url.split("/").pop()}:${frame.lineNumber + 1}` : "";
    const key = `${name}  ${where}`;
    hits.set(key, (hits.get(key) ?? 0) + dt);
  });

  return {
    total,
    samples: profile.samples.length,
    ranked: [...hits.entries()].sort((a, b) => b[1] - a[1]),
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Drag inside the page: a guest window is never the foreground tab. */
async function dragInPage(page, componentId, dx, dy, steps) {
  return page.evaluate(
    async ({ componentId, dx, dy, steps }) => {
      const el = document.querySelector(`[data-id="${componentId}"]`);
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const fire = (type, x, y, buttons) =>
        el.dispatchEvent(
          new MouseEvent(type, {
            clientX: x,
            clientY: y,
            button: 0,
            buttons,
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );

      fire("mousedown", startX, startY, 1);
      for (let step = 1; step <= steps; step++) {
        const angle = (step / steps) * Math.PI * 4;
        window.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: startX + Math.cos(angle) * dx,
            clientY: startY + Math.sin(angle) * dy,
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
        await wait(16);
      }
      window.dispatchEvent(
        new MouseEvent("mouseup", { button: 0, buttons: 0, bubbles: true, view: window }),
      );
      return true;
    },
    { componentId, dx, dy, steps },
  );
}

/** Open a live session on `host` and return the invite link. */
async function startLiveSession(host) {
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
  return link;
}

async function joinAsGuest(context, link) {
  const page = await context.newPage();
  await page.goto(link, { waitUntil: "domcontentloaded" });
  await page
    .getByPlaceholder(/e\.g\. Alex|ex\.: Alex/i)
    .first()
    .fill("Guest");
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
  // A big diagram takes a while to reach a fresh guest: snapshot over the wire,
  // then a first render of every node.
  await page.waitForSelector(".react-flow__node", { timeout: 180_000 });
  return page;
}

let hotCallers = [];
let hotName = null;
let guest = null;

async function main() {
  const seed = buildSeed(NODES);
  const browser = await chromium.launch({ headless: MODE === "remote" ? true : !HEADED });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

  await context.addInitScript(
    ({ key, payload }) => {
      window.localStorage.setItem(key, payload);
      const perf = { longtasks: [], frames: [], recording: false };
      window.__perf = perf;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          perf.longtasks.push({ start: entry.startTime, dur: entry.duration });
        }
      }).observe({ entryTypes: ["longtask"] });
      window.__startFrames = () => {
        perf.frames = [];
        perf.recording = true;
        // Long tasks accumulate from page load; the drag window starts here.
        perf.since = performance.now();
        let last = performance.now();
        const tick = (now) => {
          perf.frames.push(now - last);
          last = now;
          if (perf.recording) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };
      window.__stopFrames = () => {
        perf.recording = false;
        return perf.frames;
      };
    },
    { key: STORAGE_KEY, payload: seed.payload },
  );

  const page = await context.newPage();
  await page.goto(`${APP_URL}/model/${seed.diagramId}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".react-flow__node", { timeout: 30_000 });
  await page.waitForFunction(
    (expected) => document.querySelectorAll(".react-flow__node").length >= expected,
    Math.min(NODES, 40),
    { timeout: 30_000 },
  );
  // Let the first paint, fitView and any lazy work settle before sampling.
  await page.waitForTimeout(2500);

  const onScreen = await page.evaluate(() => document.querySelectorAll(".react-flow__node").length);

  const target = await page.evaluate(() => {
    const rects = [...document.querySelectorAll(".react-flow__node")].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.getAttribute("data-id"), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    // Pick a node near the middle of the visible pane so the drag stays on screen.
    const pane = document.querySelector(".react-flow__pane").getBoundingClientRect();
    const cx = pane.left + pane.width / 2;
    const cy = pane.top + pane.height / 2;
    rects.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    return rects[0];
  });

  /** A fast profile of a drag that no longer drags would be worthless. */
  const positionOf = (id) =>
    page.evaluate((nodeId) => {
      const el = document.querySelector(`[data-id="${nodeId}"]`);
      return el ? getComputedStyle(el).transform : null;
    }, id);
  const positionBefore = await positionOf(target.id);

  const cdp = await context.newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 100 });

  let guestContext = null;
  if (MODE === "remote") {
    const link = await startLiveSession(page);
    guestContext = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    guest = await joinAsGuest(guestContext, link);
    await page.waitForTimeout(1500);
  }

  await page.evaluate(() => window.__startFrames());
  await cdp.send("Profiler.start");
  const startedAt = Date.now();

  if (MODE === "remote") {
    // The host receives; the guest is the one moving something.
    await dragInPage(guest, target.id, 160, 110, DRAG_STEPS);
  } else {
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    for (let step = 0; step < DRAG_STEPS; step++) {
      const angle = (step / DRAG_STEPS) * Math.PI * 4;
      await page.mouse.move(target.x + Math.cos(angle) * 160, target.y + Math.sin(angle) * 110);
    }
    await page.mouse.up();
  }

  const wallMs = Date.now() - startedAt;
  if (MODE === "remote") await page.waitForTimeout(1500);
  const positionAfter = await positionOf(target.id);
  if (positionBefore === positionAfter) {
    console.error(
      `\nO nó ${target.id} não saiu do lugar (${positionBefore}). O arraste quebrou — ` +
        `os números abaixo não medem nada.`,
    );
    await browser.close();
    process.exit(2);
  }
  const { profile } = await cdp.send("Profiler.stop");
  const probe = await page.evaluate(() => window.__rfProbe ?? null);
  const frames = await page.evaluate(() => window.__stopFrames());
  const longtasks = await page.evaluate(() =>
    window.__perf.longtasks.filter((task) => task.start >= window.__perf.since),
  );

  const { total, samples, ranked } = selfTimeByFunction(profile);
  const blocked = longtasks.reduce((sum, task) => sum + task.dur, 0);
  const slowFrames = frames.filter((d) => d > 20).length;

  const report = {
    label: LABEL,
    nodes: NODES,
    nodesInDom: onScreen,
    draggedNode: target.id,
    movedFrom: positionBefore,
    movedTo: positionAfter,
    dragSteps: DRAG_STEPS,
    wallMs,
    profileSamples: samples,
    jsSelfMs: Number(total.toFixed(1)),
    jsShare: `${((total / wallMs) * 100).toFixed(1)}%`,
    frames: frames.length,
    medianFrameMs: Number(
      [...frames].sort((a, b) => a - b)[Math.floor(frames.length / 2)]?.toFixed(2) ?? 0,
    ),
    p95FrameMs: Number(
      [...frames].sort((a, b) => a - b)[Math.floor(frames.length * 0.95)]?.toFixed(2) ?? 0,
    ),
    slowFrames,
    longtaskCount: longtasks.length,
    longtaskMs: Number(blocked.toFixed(1)),
    probe,
    hotFunction: hotName,
    hotCallers,
    top: ranked.slice(0, 28).map(([name, ms]) => ({
      name,
      ms: Number(ms.toFixed(1)),
      pct: `${((ms / total) * 100).toFixed(1)}%`,
    })),
  };

  // Flat self time names the expensive function; this names who asked for it.
  // Defaults to the costliest real frame — HOT=<name> to aim it somewhere else.
  const synthetic = new Set(["(program)", "(idle)", "(garbage collector)", "(root)"]);
  hotName =
    process.env.HOT ??
    ranked.find(([key]) => !synthetic.has(key.split("  ")[0]))?.[0].split("  ")[0] ??
    null;
  hotCallers = hotName
    ? callersOf(profile, (frame) => (frame.functionName || "(anonymous)") === hotName).slice(0, 12)
    : [];

  const out = `${process.env.OUT_DIR ?? "."}/render-profile-${LABEL}.json`;
  writeFileSync(out, JSON.stringify(report, null, 2));

  console.log(
    `\n=== ${LABEL} [${MODE}] — ${NODES} nós (${onScreen} no DOM), ${
      MODE === "remote" ? "host recebendo" : "arrastando"
    } ${target.id} ===`,
  );
  console.log(
    `janela ${wallMs}ms · JS ${report.jsSelfMs}ms (${report.jsShare}) · ${samples} amostras`,
  );
  console.log(
    `frames ${frames.length} · mediana ${report.medianFrameMs}ms · p95 ${report.p95FrameMs}ms · >20ms: ${slowFrames}`,
  );
  console.log(`long tasks ${longtasks.length} · ${report.longtaskMs}ms bloqueados`);
  if (probe) {
    console.log(
      `\nprobe: ${probe.canvasRenders} renders do Canvas · ${probe.notifications} notificações do store`,
    );
    const byKey = Object.entries(probe.byKey).sort((a, b) => b[1] - a[1]);
    for (const [key, count] of byKey.slice(0, 20)) {
      console.log(`  ${String(count).padStart(6)}x  ${key}`);
    }
    if (probe.churn) {
      console.log(`\nidentidades que mudam por render do Canvas:`);
      for (const [key, count] of Object.entries(probe.churn).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${String(count).padStart(6)}x  ${key}`);
      }
    }
  }
  if (hotCallers.length > 0) {
    console.log(`\nquem chama ${hotName}:`);
    for (const [chain, ms] of hotCallers) {
      console.log(`  ${ms.toFixed(1).padStart(7)}ms  ${chain}`);
    }
  }
  console.log(`\ntop self time:`);
  for (const row of report.top) {
    console.log(`  ${row.ms.toString().padStart(7)}ms  ${row.pct.padStart(6)}  ${row.name}`);
  }
  console.log(`\n-> ${out}`);

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
