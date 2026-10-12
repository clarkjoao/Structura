/**
 * Reconnect and convergence harness for live collaboration (protocol v3), in real browsers.
 *
 * A host shares a seed diagram, a guest joins, and sockets are cut under them the way a network or
 * a dying relay pod would. After every scenario the run asserts:
 *   - the guest never sits on "Syncing…" (its canvas is back),
 *   - no page threw (the old React Flow remount crash included),
 *   - host and guest hold the same diagram (positions, components, connections).
 *
 * Run against the multi-relay stack to exercise rooms spread across pods:
 *
 *   docker compose -f deploy/compose/docker-compose.yml up --build -d
 *   npm run dev                                   # app on :8080
 *   node scripts/collab-reconnect.mjs             # all scenarios
 *   SCENARIO=chaos CYCLES=10 node scripts/collab-reconnect.mjs
 *
 * Env: APP_URL (http://localhost:8080), WS_URL (ws://localhost:3000/ws), SEED_DIAGRAM
 * (d-pl-dp-hub), SCENARIO (guest-drop | host-drop | drop-mid-drag | lock | background | chaos | all),
 * CYCLES (10), BACKGROUND_MS (60000), DEBUG (log frames).
 * Exits non-zero when any assertion fails.
 */
import { chromium } from "playwright";

const APP_URL = process.env.APP_URL ?? "http://localhost:8080";
const WS_URL = process.env.WS_URL ?? "ws://localhost:3000/ws";
const SEED_DIAGRAM = process.env.SEED_DIAGRAM ?? "d-pl-dp-hub";
const SCENARIO = process.env.SCENARIO ?? "all";
const CYCLES = Number(process.env.CYCLES ?? 10);
const BACKGROUND_MS = Number(process.env.BACKGROUND_MS ?? 60_000);
const STORAGE_KEY = "structura_diagram-store";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`  ${ok ? "ok  " : "FAIL"} ${message}`);
};

/** Route a page's sockets through the harness so it can cut the newest one. */
async function interceptable(page, label = "") {
  const sockets = [];
  await page.routeWebSocket(/\/ws/, (ws) => {
    const server = ws.connectToServer();
    sockets.push({ ws, server });
    ws.onMessage((m) => {
      if (process.env.DEBUG && !String(m).includes('"cursor"'))
        console.log(`    ${label} >> ${String(m).slice(0, 400)}`);
      server.send(m);
    });
    server.onMessage((m) => {
      if (process.env.DEBUG && !String(m).includes('"cursors"'))
        console.log(`    ${label} << ${String(m).slice(0, 400)}`);
      ws.send(m);
    });
  });
  return () => {
    const last = sockets[sockets.length - 1];
    last?.ws.close({ code: 1006 }).catch(() => {});
    last?.server.close().catch(() => {});
  };
}

async function readDiagram(page) {
  return page.evaluate(
    ([key, id]) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const d = JSON.parse(raw).state.diagrams?.[id];
      if (!d) return null;
      const layouts = {};
      for (const [k, l] of Object.entries(d.nodeLayouts ?? {}))
        layouts[k] = [Math.round(l.x), Math.round(l.y)];
      return {
        layouts,
        components: Object.keys(d.snapshot?.components ?? {}).sort(),
        connections: Object.keys(d.snapshot?.connections ?? {}).sort(),
        canvasNodes: document.querySelectorAll(".react-flow__node").length,
        syncing: /Syncing…|Sincronizando…/.test(document.body.innerText),
      };
    },
    [STORAGE_KEY, SEED_DIAGRAM],
  );
}

/** The persisted diagram, waiting for the first debounced write if needed. */
async function readDiagramSoon(page) {
  for (let i = 0; i < 20; i++) {
    const d = await readDiagram(page);
    if (d) return d;
    await sleep(250);
  }
  throw new Error("diagram never persisted");
}

function sameDiagram(a, b) {
  return (
    a &&
    b &&
    JSON.stringify(a.layouts) === JSON.stringify(b.layouts) &&
    JSON.stringify(a.components) === JSON.stringify(b.components) &&
    JSON.stringify(a.connections) === JSON.stringify(b.connections)
  );
}

async function drag(page, id, dx, dy) {
  if (process.env.DEBUG) {
    const info = await page.evaluate((nodeId) => {
      const el = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`);
      const r = el?.getBoundingClientRect();
      return {
        found: Boolean(el),
        x: r?.x,
        y: r?.y,
        w: innerWidth,
        h: innerHeight,
        cls: el?.className,
      };
    }, id);
    console.log(`    drag ${id}`, JSON.stringify(info));
  }
  return page.evaluate(
    async ({ id, dx, dy }) => {
      const el = document.querySelector(`.react-flow__node[data-id="${id}"]`);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const sx = r.left + r.width / 2;
      const sy = r.top + r.height / 2;
      const nap = (ms) => new Promise((res) => setTimeout(res, ms));
      const fire = (t, target, x, y, b) =>
        target.dispatchEvent(
          new MouseEvent(t, {
            clientX: x,
            clientY: y,
            button: 0,
            buttons: b,
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
      fire("mousedown", el, sx, sy, 1);
      for (let k = 1; k <= 6; k++) {
        fire("mousemove", window, sx + (dx * k) / 6, sy + (dy * k) / 6, 1);
        await nap(16);
      }
      fire("mouseup", window, sx + dx, sy + dy, 0);
      return true;
    },
    { id, dx, dy },
  );
}

async function startSession(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`host: ${e.message}`));
  const cut = await interceptable(page, "HOST");
  await page.goto(`${APP_URL}/model/${SEED_DIAGRAM}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".react-flow__node", { timeout: 60_000 });
  await page
    .getByRole("button", { name: /Live session|Sessão ao vivo/i })
    .first()
    .click();
  await page
    .getByPlaceholder(/e\.g\. Alex|ex\.: Alex/i)
    .first()
    .fill("Host");
  const srv = page.locator('input[placeholder*="ws://"]').first();
  if (await srv.count()) await srv.fill(WS_URL);
  const link = await page
    .locator('input[placeholder*="Opens when"], input[placeholder*="Abre"]')
    .first()
    .inputValue();
  await page
    .getByRole("button", { name: /Start session|Iniciar sessão/i })
    .first()
    .click();
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(1500);
  // Drag only leaf nodes: dragging a container drags its children, and some containers are fixed.
  const ids = await page.evaluate(
    ([key, id]) => {
      const d = JSON.parse(window.localStorage.getItem(key)).state.diagrams[id];
      const components = Object.values(d.snapshot.components);
      const parents = new Set(components.map((c) => c.parentId).filter(Boolean));
      // Only nodes the editor lets you drag (an endpoint, say, is pinned to its parent).
      const onCanvas = new Set(
        [...document.querySelectorAll(".react-flow__node.draggable")]
          .filter((n) => !n.classList.contains("react-flow__node-endpoint"))
          .map((n) => n.getAttribute("data-id")),
      );
      return components.map((c) => c.id).filter((cid) => !parents.has(cid) && onCanvas.has(cid));
    },
    [STORAGE_KEY, SEED_DIAGRAM],
  );
  return { page, cut, link, errors, ids };
}

async function joinGuest(browser, link, errors) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`guest: ${e.message}`));
  const cut = await interceptable(page, "GUEST");
  await page.goto(link, { waitUntil: "domcontentloaded" });
  await page
    .getByPlaceholder(/e\.g\. Alex|ex\.: Alex/i)
    .first()
    .fill("Guest");
  const srv = page.locator('input[placeholder*="ws://"]').first();
  if (await srv.count()) await srv.fill(WS_URL);
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
  return { page, cut };
}

async function settleAndCompare(label, host, guest, errors) {
  // Let reconnects land and the persisted copies catch up.
  let h = null;
  let g = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    h = await readDiagram(host);
    g = await readDiagram(guest);
    if (sameDiagram(h, g) && g.canvasNodes > 0 && !g.syncing && i >= 3) break;
  }
  check(g && g.canvasNodes > 0 && !g.syncing, `${label}: guest canvas is back (not stuck syncing)`);
  check(sameDiagram(h, g), `${label}: host and guest hold the same diagram`);
  check(errors.length === 0, `${label}: no page errors${errors.length ? ` — ${errors[0]}` : ""}`);
}

async function scenario(name, run) {
  console.log(`\n=== ${name} ===`);
  const browser = await chromium.launch({ headless: true });
  try {
    const { page: host, cut: cutHost, link, errors, ids } = await startSession(browser);
    const { page: guest, cut: cutGuest } = await joinGuest(browser, link, errors);
    const initial = await readDiagram(host);
    await run({ host, guest, cutHost, cutGuest, ids, errors });
    // Guard against a vacuous pass: the edits must actually have landed. The persisted copy is
    // written on a debounce, so give it time.
    await sleep(2000);
    const final = await readDiagram(host);
    const moved = Object.keys(final?.layouts ?? {}).filter(
      (id) => JSON.stringify(final.layouts[id]) !== JSON.stringify(initial?.layouts[id]),
    );
    check(moved.length > 0, `${name}: edits landed (${moved.length} node(s) moved)`);
  } catch (err) {
    check(false, `${name}: ${err.message}`);
  } finally {
    await browser.close();
  }
}

const scenarios = {
  "guest-drop": () =>
    scenario("guest drops", async ({ host, guest, cutGuest, ids, errors }) => {
      await drag(guest, ids[0], 80, 40);
      await sleep(800);
      cutGuest();
      await sleep(1500);
      await drag(host, ids[1 % ids.length], 60, 30);
      await settleAndCompare("guest drop", host, guest, errors);
    }),
  "host-drop": () =>
    scenario("host drops", async ({ host, guest, cutHost, ids, errors }) => {
      cutHost();
      await sleep(300);
      // The room keeps working while the host is away.
      await drag(guest, ids[2 % ids.length], 70, 50);
      await sleep(3000);
      await settleAndCompare("host drop", host, guest, errors);
    }),
  "drop-mid-drag": () =>
    scenario("guest drops mid-drag", async ({ host, guest, cutGuest, ids, errors }) => {
      const dragging = drag(guest, ids[3 % ids.length], 120, 90);
      await sleep(40);
      cutGuest();
      await dragging;
      await sleep(1500);
      await drag(host, ids[4 % ids.length], 40, 40);
      await settleAndCompare("drop mid-drag", host, guest, errors);
    }),
  background: () =>
    scenario("host tab in the background", async ({ host, guest, ids, errors }) => {
      // Hide the host behind another tab and take animation frames away entirely: whatever the
      // browser's throttling, sync must not depend on them.
      const other = await host.context().newPage();
      await other.goto("about:blank");
      await other.bringToFront();
      await host.evaluate(() => {
        window.requestAnimationFrame = () => 0;
      });
      const until = Date.now() + BACKGROUND_MS;
      let i = 0;
      while (Date.now() < until) {
        await drag(guest, ids[i % ids.length], 15, 10);
        i += 1;
        await sleep(Math.min(3000, Math.max(200, BACKGROUND_MS / 20)));
      }
      await settleAndCompare("background host", host, guest, errors);
    }),
  lock: () =>
    scenario("drag lock", async ({ host, guest, ids, errors }) => {
      const id = ids[0];
      // The host grabs the node and keeps holding it.
      await host.evaluate((nodeId) => {
        const el = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`);
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const fire = (t, target, cx, cy, b) =>
          target.dispatchEvent(
            new MouseEvent(t, {
              clientX: cx,
              clientY: cy,
              button: 0,
              buttons: b,
              bubbles: true,
              cancelable: true,
              view: window,
            }),
          );
        fire("mousedown", el, x, y, 1);
        for (let k = 1; k <= 4; k++) fire("mousemove", window, x + k * 8, y + k * 4, 1);
        window.__releaseHeld = () => fire("mouseup", window, x + 32, y + 16, 0);
      }, id);
      await sleep(800);
      const lockShown = await guest
        .locator(`.react-flow__node[data-id="${id}"] [aria-label*="Host"]`)
        .count();
      check(lockShown > 0, "drag lock: the guest sees who holds the node");
      const before = (await readDiagramSoon(guest)).layouts[id];
      await drag(guest, id, 150, 120);
      await sleep(1500);
      const during = (await readDiagramSoon(guest)).layouts[id];
      check(
        JSON.stringify(before) === JSON.stringify(during),
        "drag lock: the guest cannot move a held node",
      );
      await host.evaluate(() => window.__releaseHeld());
      await sleep(1500);
      await drag(guest, id, 90, 70);
      await settleAndCompare("drag lock released", host, guest, errors);
      const after = (await readDiagramSoon(host)).layouts[id];
      check(
        JSON.stringify(after) !== JSON.stringify(during),
        "drag lock: once released, the guest's move lands",
      );
    }),
  chaos: () =>
    scenario(
      `chaos (${CYCLES} cycles)`,
      async ({ host, guest, cutHost, cutGuest, ids, errors }) => {
        for (let c = 0; c < CYCLES; c++) {
          const who = Math.random() < 0.5 ? "host" : "guest";
          (who === "host" ? cutHost : cutGuest)();
          await drag(host, ids[c % ids.length], 30 + (c % 3) * 10, 25);
          await sleep(200 + Math.random() * 2500);
          await drag(guest, ids[(c + 3) % ids.length], 20, 30 + (c % 4) * 5);
          await settleAndCompare(`cycle ${c} (cut ${who})`, host, guest, errors);
        }
      },
    ),
};

const selected =
  SCENARIO === "all"
    ? ["guest-drop", "host-drop", "drop-mid-drag", "background", "chaos"]
    : [SCENARIO];
for (const name of selected) await scenarios[name]();

console.log(`\n${failures.length === 0 ? "PASS" : `FAIL (${failures.length})`}`);
process.exit(failures.length === 0 ? 0 : 1);
