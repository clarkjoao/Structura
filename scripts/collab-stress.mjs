/**
 * Collaboration stress test — 15 people editing one diagram, live.
 *
 * The host runs in a visible window and is the one to watch: every remote
 * cursor, drag and new element shows up there. Guests default to headless so
 * the machine survives 15 browsers; SHOW_GUESTS=1 tiles them on screen too.
 *
 *   npm run dev            # terminal 1 — the app
 *   npm run proxy          # terminal 2 — the collab relay
 *   node scripts/collab-stress.mjs
 *
 * Env: GUESTS, DURATION_MS, NODES, SHOW_GUESTS, APP_URL, WS_URL, SLOW_MO
 */
import { chromium } from "playwright";

const APP_URL_OVERRIDE = process.env.APP_URL ?? null;
const WS_URL = process.env.WS_URL ?? "ws://localhost:3000/ws";
const GUESTS = Number(process.env.GUESTS ?? 14);
const DURATION_MS = Number(process.env.DURATION_MS ?? 60_000);
const NODES = Number(process.env.NODES ?? 24);
const SHOW_GUESTS = process.env.SHOW_GUESTS === "1";
const SLOW_MO = Number(process.env.SLOW_MO ?? 0);

// Same key as LocalStorageAdapter prefix + PERSIST_KEY, and the current
// PERSIST_SCHEMA_VERSION — seeding at an older version would silently run
// migrations instead of exercising the real shape.
const STORAGE_KEY = "structura_diagram-store";
const PERSIST_VERSION = 12;

/**
 * Find the dev server.
 *
 * The configured port is 8080, but that is a popular port — a kubectl
 * port-forward or another tool may already hold it, in which case vite still
 * reports 8080 while localhost resolves to the other process. Probe for a
 * response that actually looks like this app instead of trusting the port.
 */
async function findAppUrl() {
  if (APP_URL_OVERRIDE) return APP_URL_OVERRIDE;

  const candidates = [8080, 5273, 5173, 4173].flatMap((port) => [
    `http://localhost:${port}`,
    `https://localhost:${port}`,
  ]);

  for (const base of candidates) {
    try {
      const res = await fetch(`${base}/`, {
        redirect: "manual",
        signal: AbortSignal.timeout(2500),
      });
      if (res.status >= 300 && res.status < 400) continue; // someone else's app
      const body = await res.text();
      if (/structura|<div id="root"|\/src\/main\.tsx/i.test(body)) return base;
    } catch {
      // port closed or wrong protocol — keep looking
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The document the session opens on. Built here so the run never depends on
// whatever happens to be in the browser profile.
// ---------------------------------------------------------------------------

function buildSeed(nodeCount) {
  const diagramId = `collab-stress-${Date.now().toString(36)}`;
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
  const payload = {
    state: {
      diagrams: {
        [diagramId]: {
          id: diagramId,
          name: "Collab Stress — 15 pessoas",
          domain: "",
          level: "context",
          description: "Diagrama semeado para o teste de estresse de colaboração",
          snapshot: { components, connections, flows: {}, iconLibrary: {} },
          nodeLayouts,
          edgeLayouts: {},
          viewport: { x: 0, y: 0, zoom: 0.6 },
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
  };

  return { diagramId, payload: JSON.stringify(payload), componentIds: ids };
}

// ---------------------------------------------------------------------------
// In-page interaction
//
// Everything is dispatched inside the page rather than driven with real OS
// input. Only one window can hold focus, and real mouse events aimed at a
// backgrounded window land somewhere else or nowhere — with 15 browsers open
// that would make most bots silently idle.
// ---------------------------------------------------------------------------

const pageHelpers = {
  /** Broadcast a cursor position by moving the pointer over the canvas. */
  async moveCursor(page, x, y) {
    await page.evaluate(
      ({ x, y }) => {
        const pane = document.querySelector(".react-flow__pane");
        if (!pane) return;
        const r = pane.getBoundingClientRect();
        pane.dispatchEvent(
          new PointerEvent("pointermove", {
            clientX: r.left + x,
            clientY: r.top + y,
            bubbles: true,
            cancelable: true,
            pointerType: "mouse",
          }),
        );
      },
      { x, y },
    );
  },

  /** Drag a node by (dx, dy), mirroring the event sequence React Flow expects. */
  async dragNode(page, componentId, dx, dy) {
    return page.evaluate(
      async ({ componentId, dx, dy }) => {
        const el = document.querySelector(`[data-id="${componentId}"]`);
        if (!el) return false;

        const rect = el.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;
        const steps = 8;
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

        el.dispatchEvent(
          new MouseEvent("mousedown", {
            clientX: startX,
            clientY: startY,
            button: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );

        for (let i = 1; i <= steps; i++) {
          window.dispatchEvent(
            new MouseEvent("mousemove", {
              clientX: startX + (dx * i) / steps,
              clientY: startY + (dy * i) / steps,
              button: 0,
              buttons: 1,
              bubbles: true,
              cancelable: true,
              view: window,
            }),
          );
          await sleep(16);
        }

        window.dispatchEvent(
          new MouseEvent("mouseup", {
            clientX: startX + dx,
            clientY: startY + dy,
            button: 0,
            buttons: 0,
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
        return true;
      },
      { componentId, dx, dy },
    );
  },

  /** Drag from one node's source handle to another node, creating an edge. */
  async connectNodes(page, sourceId, targetId) {
    return page.evaluate(
      async ({ sourceId, targetId }) => {
        const source = document.querySelector(`[data-id="${sourceId}"]`);
        const target = document.querySelector(`[data-id="${targetId}"]`);
        if (!source || !target) return false;

        const handle =
          source.querySelector(".react-flow__handle.source") ??
          source.querySelector(".react-flow__handle");
        if (!handle) return false;

        const from = handle.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        const startX = from.left + from.width / 2;
        const startY = from.top + from.height / 2;
        const endX = to.left + to.width / 2;
        const endY = to.top + to.height / 2;
        const steps = 10;
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

        const fire = (type, target, x, y, buttons) =>
          target.dispatchEvent(
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

        fire("mousedown", handle, startX, startY, 1);
        for (let i = 1; i <= steps; i++) {
          fire(
            "mousemove",
            window,
            startX + ((endX - startX) * i) / steps,
            startY + ((endY - startY) * i) / steps,
            1,
          );
          await sleep(16);
        }
        fire("mouseup", target, endX, endY, 0);
        return true;
      },
      { sourceId, targetId },
    );
  },

  /** Right-click a node and pick Duplicate from the context menu. */
  async duplicateNode(page, componentId) {
    const node = page.locator(`[data-id="${componentId}"]`).first();
    if ((await node.count()) === 0) return false;

    await node.click({ button: "right", force: true, timeout: 4000 }).catch(() => {});
    // The app defaults to pt-BR but may render in English.
    const item = page.getByText(/^(Duplicar|Duplicate)$/).first();
    try {
      await item.waitFor({ state: "visible", timeout: 2500 });
      await item.click({ timeout: 2500 });
      return true;
    } catch {
      await page.keyboard.press("Escape").catch(() => {});
      return false;
    }
  },
};

// ---------------------------------------------------------------------------
// Session setup
// ---------------------------------------------------------------------------

async function waitForCanvas(page, label) {
  await page.waitForSelector(".react-flow__node", { timeout: 60_000 });
  await page.waitForSelector(".react-flow__viewport", { timeout: 15_000 });
  console.log(`  ${label}: canvas pronto`);
}

async function openHost(browser, seed, appUrl) {
  const context = await browser.newContext({ viewport: null, ignoreHTTPSErrors: true });
  await context.addInitScript(
    ([key, payload]) => {
      window.localStorage.setItem(key, payload);
    },
    [STORAGE_KEY, seed.payload],
  );

  const page = await context.newPage();
  await page.goto(`${appUrl}/model/${seed.diagramId}`, { waitUntil: "domcontentloaded" });
  await waitForCanvas(page, "host");

  // Open the live-session dialog. Label depends on the UI language.
  await page
    .getByRole("button", { name: /Sessão ao vivo|Live session/i })
    .first()
    .click({ timeout: 15_000 });

  const nameInput = page.getByPlaceholder(/ex\.: Alex|e\.g\. Alex/i).first();
  await nameInput.waitFor({ state: "visible", timeout: 10_000 });
  await nameInput.fill("Host");

  // Point the session at the relay under test if the dialog exposes the field.
  const serverInput = page.locator('input[placeholder*="ws://"]').first();
  if (await serverInput.count()) {
    await serverInput.fill(WS_URL).catch(() => {});
  }

  // The invite link is filled in while the dialog is open, before the session
  // starts. Read it by value so the field's label and language do not matter.
  const inviteHandle = await page.waitForFunction(
    () => {
      const inputs = [...document.querySelectorAll("input")];
      const hit = inputs.find((i) => typeof i.value === "string" && i.value.includes("/collab/"));
      return hit ? hit.value : null;
    },
    { timeout: 20_000 },
  );
  const link = await inviteHandle.jsonValue();

  await page
    .getByRole("button", { name: /Iniciar sessão|Start session/i })
    .first()
    .click({ timeout: 10_000 });

  // Leave the canvas unobstructed for watching.
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(1000);

  return { context, page, link };
}

async function openGuest(browser, index, link, slot) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: SHOW_GUESTS ? { width: 640, height: 420 } : { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await page.goto(link, { waitUntil: "domcontentloaded" });

  // The room asks for a display name before letting anyone in. Wait for that
  // dialog rather than assuming it has rendered — going straight to the canvas
  // would just block behind it.
  const nameInput = page.getByPlaceholder(/e\.g\. Alex|ex\.: Alex/i).first();
  await nameInput.waitFor({ state: "visible", timeout: 20_000 });
  await nameInput.fill(`Guest ${index}`);

  const serverInput = page.locator('input[placeholder*="ws://"]').first();
  if (await serverInput.count()) {
    await serverInput.fill(WS_URL).catch(() => {});
  }

  // Join stays disabled until the relay has been reached: the dialog requires
  // a successful connection test first. That is an icon-only button, so match
  // it by title.
  await page
    .locator('button[title="Test connection"], button[title="Testar conexão"]')
    .first()
    .click({ timeout: 10_000 });
  await page
    .getByText(/Server online|Servidor no ar/i)
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });

  await page
    .getByRole("button", { name: /^(Join|Entrar)$/i })
    .first()
    .click({ timeout: 10_000 });

  await page.waitForSelector(".react-flow__node", { timeout: 45_000 });

  if (slot !== undefined && SHOW_GUESTS) {
    // Best-effort tiling so the windows do not stack on top of each other.
    const col = slot % 5;
    const row = Math.floor(slot / 5);
    await page
      .evaluate(({ x, y }) => window.moveTo(x, y), { x: col * 300, y: 120 + row * 220 })
      .catch(() => {});
  }
  return { context, page };
}

// ---------------------------------------------------------------------------
// Behaviour
// ---------------------------------------------------------------------------

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const between = (a, b) => a + Math.random() * (b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One participant's activity loop. Cursor movement is continuous, the heavier
 * actions fire at intervals, so the session looks like people working rather
 * than a benchmark.
 */
async function runBot({ page, name, componentIds, stats, deadline, canAddElements }) {
  let x = between(100, 900);
  let y = between(100, 600);

  while (Date.now() < deadline) {
    try {
      // Wander the cursor: several small steps between heavier actions.
      for (let i = 0; i < 6 && Date.now() < deadline; i++) {
        x = Math.max(40, Math.min(1200, x + between(-140, 140)));
        y = Math.max(40, Math.min(760, y + between(-110, 110)));
        await pageHelpers.moveCursor(page, x, y);
        stats.cursorMoves++;
        await sleep(between(60, 140));
      }

      const roll = Math.random();

      if (roll < 0.6) {
        const id = pick(componentIds);
        if (await pageHelpers.dragNode(page, id, between(-140, 140), between(-110, 110))) {
          stats.drags++;
        }
      } else if (roll < 0.85) {
        const a = pick(componentIds);
        const b = pick(componentIds.filter((c) => c !== a));
        if (b && (await pageHelpers.connectNodes(page, a, b))) {
          stats.edges++;
        }
      } else if (canAddElements) {
        if (await pageHelpers.duplicateNode(page, pick(componentIds))) {
          stats.added++;
        }
      } else {
        const id = pick(componentIds);
        if (await pageHelpers.dragNode(page, id, between(-90, 90), between(-70, 70))) {
          stats.drags++;
        }
      }

      await sleep(between(200, 700));
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 3) console.warn(`  ${name}: ${String(err).split("\n")[0]}`);
      await sleep(500);
    }
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const appUrl = await findAppUrl();
  if (!appUrl) {
    console.error(
      "\nNão encontrei o dev server.\n" +
        "Rode `npm run dev` e, se a porta 8080 estiver ocupada (kubectl port-forward, etc),\n" +
        "suba em outra e passe APP_URL=http://localhost:PORTA\n",
    );
    process.exit(1);
  }

  const seed = buildSeed(NODES);

  console.log(`\n=== COLLAB STRESS: ${GUESTS + 1} pessoas ===`);
  console.log(`app       ${appUrl}`);
  console.log(`relay     ${WS_URL}`);
  console.log(`documento ${seed.diagramId} (${NODES} nós, semeado antes de abrir)`);
  console.log(`duração   ${DURATION_MS / 1000}s`);
  console.log(`convidados ${SHOW_GUESTS ? "visíveis" : "headless"}\n`);

  const hostBrowser = await chromium.launch({
    headless: false,
    slowMo: SLOW_MO,
    args: ["--window-size=1600,1000", "--window-position=0,0"],
  });
  const guestBrowser = await chromium.launch({ headless: !SHOW_GUESTS, slowMo: 0 });

  const contexts = [];
  let host;

  try {
    host = await openHost(hostBrowser, seed, appUrl);
    contexts.push(host.context);
    console.log(`  convite: ${host.link}\n`);

    const guests = [];
    for (let i = 1; i <= GUESTS; i++) {
      try {
        const guest = await openGuest(guestBrowser, i, host.link, i - 1);
        contexts.push(guest.context);
        guests.push({ ...guest, name: `Guest ${i}` });
        process.stdout.write(`\r  entrando: ${i}/${GUESTS}`);
      } catch (err) {
        console.warn(`\n  Guest ${i} não entrou: ${String(err).split("\n")[0]}`);
      }
    }
    console.log(`\n  ${guests.length + 1} participantes na sala\n`);
    console.log(`  Observe a janela do host: os cursores, arrastes e novos`);
    console.log(`  elementos dos outros ${guests.length} aparecem lá.\n`);

    const stats = {
      cursorMoves: 0,
      drags: 0,
      edges: 0,
      added: 0,
      errors: 0,
    };
    const deadline = Date.now() + DURATION_MS;

    const ticker = setInterval(() => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      process.stdout.write(
        `\r  ${left}s restantes | cursores ${stats.cursorMoves} | arrastes ${stats.drags} | arestas ${stats.edges} | novos ${stats.added} | erros ${stats.errors}   `,
      );
    }, 1000);

    await Promise.all([
      runBot({
        page: host.page,
        name: "Host",
        componentIds: seed.componentIds,
        stats,
        deadline,
        canAddElements: true,
      }),
      ...guests.map((g) =>
        runBot({
          page: g.page,
          name: g.name,
          componentIds: seed.componentIds,
          stats,
          deadline,
          canAddElements: true,
        }),
      ),
    ]);

    clearInterval(ticker);

    // Let the last patches land before reading state, then check that everyone
    // ended up looking at the same diagram. Activity alone proves nothing —
    // convergence is the point.
    await sleep(3000);

    const participants = [
      { name: "Host", page: host.page },
      ...guests.map((g) => ({ name: g.name, page: g.page })),
    ];
    const readings = await Promise.all(
      participants.map(async (p) => {
        try {
          return {
            name: p.name,
            count: await p.page.locator(".react-flow__node").count(),
            // A participant showing nothing has usually been dropped from the
            // room rather than lost its nodes, so capture why.
            note: (await p.page.locator("body").innerText().catch(() => ""))
              .slice(0, 90)
              .replace(/\s+/g, " "),
          };
        } catch (err) {
          return { name: p.name, count: -1, note: String(err).split("\n")[0] };
        }
      }),
    );
    const counts = readings.map((r) => r.count);
    const hostCount = counts[0];
    const agreeing = counts.filter((c) => c === hostCount).length;
    const divergent = readings.filter((r) => r.count !== hostCount);

    console.log(`\n\n--- RESULTADO ---`);
    console.log(`participantes     ${guests.length + 1}`);
    console.log(`movimentos cursor ${stats.cursorMoves}`);
    console.log(`arrastes          ${stats.drags}`);
    console.log(`arestas criadas   ${stats.edges}`);
    console.log(`elementos novos   ${stats.added}`);
    console.log(`nós no host       ${NODES} no início → ${hostCount} no fim`);
    console.log(
      `convergência      ${agreeing}/${counts.length} veem ${hostCount} nós` +
        (agreeing === counts.length ? "  ✓" : "  ✗"),
    );
    for (const d of divergent) {
      console.log(`  divergente: ${d.name} vê ${d.count} — ${d.note}`);
    }
    console.log(`erros             ${stats.errors}\n`);
  } finally {
    await sleep(1500);
    for (const context of contexts) await context.close().catch(() => {});
    await hostBrowser.close().catch(() => {});
    await guestBrowser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
