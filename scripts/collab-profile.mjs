/**
 * CPU-profile the host while other people edit.
 *
 * The stress script says how much the main thread is blocked; this says by
 * what. Runs the same session shape with the host as a pure observer, samples
 * its profile over CDP and prints the functions with the most self time.
 *
 *   node scripts/collab-profile.mjs
 *
 * Env: GUESTS, DURATION_MS, NODES, APP_URL, WS_URL, TOP
 */
import { chromium } from "playwright";

const WS_URL = process.env.WS_URL ?? "ws://localhost:3000/ws";
const GUESTS = Number(process.env.GUESTS ?? 14);
const DURATION_MS = Number(process.env.DURATION_MS ?? 20_000);
const NODES = Number(process.env.NODES ?? 20);
const TOP = Number(process.env.TOP ?? 18);
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
      const body = await res.text();
      if (/<div id="root"|\/src\/main\.tsx/i.test(body)) return base;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

function buildSeed(nodeCount) {
  const diagramId = `collab-profile-${Date.now().toString(36)}`;
  const components = {};
  const nodeLayouts = {};
  const ids = [];
  const perRow = Math.ceil(Math.sqrt(nodeCount));
  for (let i = 0; i < nodeCount; i++) {
    const id = `cmp_${i}`;
    ids.push(id);
    components[id] = {
      id,
      name: `Service ${i}`,
      description: "",
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
  const now = new Date().toISOString();
  return {
    diagramId,
    componentIds: ids,
    payload: JSON.stringify({
      state: {
        diagrams: {
          [diagramId]: {
            id: diagramId,
            name: "Profile",
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

async function main() {
  const appUrl = await findAppUrl();
  if (!appUrl) {
    console.error("dev server não encontrado — rode `npm run dev`");
    process.exit(1);
  }
  const seed = buildSeed(NODES);
  console.log(`\n=== PERFIL DO HOST (observador) — ${GUESTS} editores ===`);
  console.log(`app ${appUrl} | ${NODES} nós | ${DURATION_MS / 1000}s\n`);

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
  console.log(`\n  perfilando...\n`);

  // Record long tasks so the profile can be read twice: overall, and
  // restricted to the windows where the frame loop actually stalled. The
  // overall view is dominated by idle and hides what causes the jank.
  await host.evaluate(() => {
    window.__stalls = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__stalls.push({ at: e.startTime, ms: e.duration });
      }
    }).observe({ entryTypes: ["longtask"] });
  });

  const cdp = await hostCtx.newCDPSession(host);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
  await cdp.send("Profiler.start");
  const t0 = await host.evaluate(() => performance.now());

  const deadline = Date.now() + DURATION_MS;
  await Promise.all(
    guests.map(async (page) => {
      while (Date.now() < deadline) {
        await dragNode(page, pick(seed.componentIds), between(-140, 140), between(-110, 110));
        await sleep(between(150, 500));
      }
    }),
  );

  const { profile } = await cdp.send("Profiler.stop");
  const stalls = await host.evaluate(() => window.__stalls);

  // Aggregate self time per function from the sample counts.
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const selfTime = new Map();
  const total = profile.samples?.length ?? 0;
  const durationMs = (profile.endTime - profile.startTime) / 1000;

  // Map each sample to page time so it can be tested against a stall window.
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  const sampleAt = [];
  let clock = profile.startTime;
  for (let i = 0; i < samples.length; i++) {
    clock += deltas[i] ?? 0;
    sampleAt.push(t0 + (clock - profile.startTime) / 1000);
  }
  const inStall = (ms) => stalls.some((s) => ms >= s.at && ms <= s.at + s.ms);

  const label = (id) => {
    const node = byId.get(id);
    if (!node) return null;
    const f = node.callFrame;
    const where = f.url ? f.url.split("/").slice(-1)[0].split("?")[0] : "";
    return `${f.functionName || "(anonymous)"}${where ? ` — ${where}` : ""}`;
  };

  const stallTime = new Map();
  let stallSamples = 0;
  for (let i = 0; i < samples.length; i++) {
    const key = label(samples[i]);
    if (!key) continue;
    selfTime.set(key, (selfTime.get(key) ?? 0) + 1);
    if (inStall(sampleAt[i])) {
      stallTime.set(key, (stallTime.get(key) ?? 0) + 1);
      stallSamples++;
    }
  }

  const ranked = [...selfTime.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP);
  console.log(`amostras: ${total} em ${durationMs.toFixed(0)}ms\n`);
  console.log("função".padEnd(58) + "self%    ms");
  console.log("-".repeat(76));
  for (const [name, count] of ranked) {
    const pct = ((count / total) * 100).toFixed(1);
    const ms = ((count / total) * durationMs).toFixed(0);
    console.log(name.slice(0, 56).padEnd(58) + pct.padStart(5) + "%" + String(ms).padStart(7));
  }
  console.log("");

  const blocked = stalls.reduce((a, s) => a + s.ms, 0);
  console.log(
    `\n=== SOMENTE DENTRO DAS ${stalls.length} LONG TASKS (${Math.round(blocked)}ms bloqueado) ===\n`,
  );
  if (stallSamples === 0) {
    console.log("nenhuma amostra caiu numa long task\n");
  } else {
    console.log("função".padEnd(58) + "self%    ms");
    console.log("-".repeat(76));
    for (const [name, count] of [...stallTime.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP)) {
      const pct = ((count / stallSamples) * 100).toFixed(1);
      const ms = ((count / stallSamples) * blocked).toFixed(0);
      console.log(name.slice(0, 56).padEnd(58) + pct.padStart(5) + "%" + String(ms).padStart(7));
    }
    console.log("");
  }

  await browser.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
