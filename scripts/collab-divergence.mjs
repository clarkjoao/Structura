/**
 * Forces the failure the checksum exists to catch, then checks it heals.
 *
 * A dropped patch that also drops its version is already caught by the gap
 * detector. The dangerous case is content drift at the *right* version: the
 * client looks up to date and stays wrong forever. This intercepts one guest's
 * socket and blanks a single incoming patch while letting its version through,
 * which reproduces exactly that.
 *
 *   node scripts/collab-divergence.mjs
 *
 * Env: APP_URL, WS_URL, NODES, OPS
 */
import { chromium } from "playwright";

const WS_URL = process.env.WS_URL ?? "ws://localhost:3000/ws";
const NODES = Number(process.env.NODES ?? 12);
const OPS = Number(process.env.OPS ?? 40);
const STORAGE_KEY = "structura_diagram-store";
/** The one entity whose update the victim will miss. */
const VICTIM_NODE = "cmp_0";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findAppUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  for (const port of [4273, 5273, 5173]) {
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
  const diagramId = `collab-div-${Date.now().toString(36)}`;
  const components = {};
  const nodeLayouts = {};
  const ids = [];
  for (let i = 0; i < nodeCount; i++) {
    const id = `cmp_${i}`;
    ids.push(id);
    components[id] = { id, name: `S${i}`, description: "", parentId: null, type: "system" };
    nodeLayouts[id] = {
      elementId: id,
      x: 140 + (i % 4) * 240,
      y: 140 + Math.floor(i / 4) * 190,
      width: 180,
      height: 90,
    };
  }
  const now = new Date().toISOString();
  return {
    diagramId,
    ids,
    payload: JSON.stringify({
      state: {
        diagrams: {
          [diagramId]: {
            id: diagramId,
            name: "Divergence",
            domain: "",
            level: "context",
            description: "",
            snapshot: { components, connections: {}, flows: {}, iconLibrary: {} },
            nodeLayouts,
            edgeLayouts: {},
            viewport: { x: 0, y: 0, zoom: 0.7 },
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

const positions = (page) =>
  page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const state = JSON.parse(raw).state;
    const diagram = state.diagrams?.[state.activeDiagramId];
    if (!diagram) return null;
    const out = {};
    for (const [id, l] of Object.entries(diagram.nodeLayouts ?? {}))
      out[id] = [Math.round(l.x), Math.round(l.y)];
    return out;
  }, STORAGE_KEY);

function differences(a, b) {
  if (!a || !b) return -1;
  let n = 0;
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id];
    const y = b[id];
    if (!x || !y || Math.abs(x[0] - y[0]) > 1 || Math.abs(x[1] - y[1]) > 1) n++;
  }
  return n;
}

async function joinGuest(page, link, name) {
  await page.goto(link, { waitUntil: "domcontentloaded" });
  await page
    .getByPlaceholder(/e\.g\. Alex|ex\.: Alex/i)
    .first()
    .fill(name);
  const srv = page.locator('input[placeholder*="ws://"]').first();
  if (await srv.count()) await srv.fill(WS_URL).catch(() => {});
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
  return page;
}

async function main() {
  const appUrl = await findAppUrl();
  if (!appUrl) {
    console.error("dev/preview server nao encontrado");
    process.exit(1);
  }
  const seed = buildSeed(NODES);
  console.log(`\n=== DIVERGENCIA FORCADA E REPARO ===`);
  console.log(`app ${appUrl} | ${NODES} nos | ${OPS} operacoes\n`);

  const browser = await chromium.launch({ headless: true });
  const hostCtx = await browser.newContext();
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
  await sleep(800);

  // The victim: one incoming patch is blanked, its version left intact.
  const victimCtx = await browser.newContext();
  await victimCtx.addInitScript(() => {
    window.__sync = { requests: 0, checksums: 0 };
  });
  const victim = await victimCtx.newPage();
  let blanked = 0;
  await victim.routeWebSocket(/\/ws/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((m) => {
      try {
        const parsed = JSON.parse(String(m));
        if (parsed.type === "sync:request" && parsed.reason === "checksum") {
          console.log("  vitima pediu resync por checksum");
        }
      } catch {
        /* not json */
      }
      server.send(m);
    });
    server.onMessage((m) => {
      const text = String(m);
      // Blank the one patch that moves the victim node, and nothing else, so
      // the drift is on an entity the host never touches again.
      if (blanked === 0 && text.includes('"session:patch"') && text.includes(VICTIM_NODE)) {
        try {
          const parsed = JSON.parse(text);
          const layouts = parsed.patch?.nodeLayouts;
          if (layouts && Object.keys(layouts).includes(VICTIM_NODE)) {
            blanked++;
            console.log(
              `  patch de ${VICTIM_NODE} apagado na versao ${parsed.version} (versao preservada)`,
            );
            ws.send(JSON.stringify({ ...parsed, patch: {} }));
            return;
          }
        } catch {
          /* not json */
        }
      }
      ws.send(m);
    });
  });

  const victimPage = await joinGuest(victim, link, "Victim");
  const healthyCtx = await browser.newContext();
  const healthy = await joinGuest(await healthyCtx.newPage(), link, "Healthy");
  await sleep(1200);

  const drag = async ({ id, dx, dy }) =>
    host.evaluate(
      async ({ id, dx, dy }) => {
        const el = document.querySelector(`[data-id="${id}"]`);
        if (!el) return;
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
      },
      { id, dx, dy },
    );

  // One move of the victim node — this is the patch that gets blanked.
  await drag({ id: VICTIM_NODE, dx: 260, dy: 180 });
  await sleep(1500);

  const afterDrift = differences(await positions(host), await positions(victimPage));
  console.log(`  deriva instalada: vitima difere do host em ${afterDrift} no(s)`);
  if (afterDrift === 0) {
    console.log("\n  !! a deriva nao pegou — o teste nao prova nada\n");
    await browser.close();
    process.exit(2);
  }

  // Now churn other nodes until the room publishes a fingerprint. The victim
  // node is never touched again, so nothing but the checksum can repair it.
  const others = seed.ids.filter((id) => id !== VICTIM_NODE);
  for (let i = 0; i < OPS; i++) {
    await drag({ id: others[i % others.length], dx: 30 + (i % 4) * 10, dy: 25 + (i % 3) * 12 });
    await sleep(110);
  }

  await sleep(6000);

  const hostPos = await positions(host);
  const victimPos = await positions(victimPage);
  const healthyPos = await positions(healthy);

  console.log("");
  console.log(`convidado saudavel vs host: ${differences(hostPos, healthyPos)} no(s) diferente(s)`);
  console.log(`vitima vs host:             ${differences(hostPos, victimPos)} no(s) diferente(s)`);
  console.log(
    differences(hostPos, victimPos) === 0
      ? "\n  => a vitima se recuperou sozinha\n"
      : "\n  => a vitima NAO se recuperou\n",
  );

  await browser.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
