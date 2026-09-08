/**
 * Measures what actually crosses the wire during a busy session.
 *
 * The profiler says the host's JS is idle; the stress script says the frame
 * loop is blocked anyway. This closes the gap by counting the traffic itself:
 * frames per second, bytes per second and the composition of each patch, as
 * seen by the host. Wraps WebSocket before the app boots so nothing is missed.
 *
 *   node scripts/collab-wire.mjs
 *
 * Env: GUESTS, DURATION_MS, NODES, APP_URL, WS_URL
 */
import { chromium } from "playwright";

const WS_URL = process.env.WS_URL ?? "ws://localhost:3000/ws";
const GUESTS = Number(process.env.GUESTS ?? 14);
const DURATION_MS = Number(process.env.DURATION_MS ?? 20_000);
const NODES = Number(process.env.NODES ?? 20);
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
  const diagramId = `collab-wire-${Date.now().toString(36)}`;
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
            name: "Wire",
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

/**
 * Counts inbound frames by type and, for patches, how many entities each one
 * carried. Installed as an init script so it wraps the constructor the app
 * itself will use.
 */
const WIRE_PROBE = () => {
  const stats = {
    startedAt: Date.now(),
    total: { count: 0, bytes: 0 },
    byType: {},
    patchEntities: [],
    patchKeys: {},
    identical: 0,
    lastPatchJson: "",
    events: [],
    longTasks: [],
  };
  window.__wire = stats;

  const Native = window.WebSocket;
  function Wrapped(url, protocols) {
    const ws = protocols === undefined ? new Native(url) : new Native(url, protocols);
    ws.addEventListener("message", (event) => {
      const raw = typeof event.data === "string" ? event.data : "";
      stats.total.count++;
      stats.total.bytes += raw.length;
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      const type = msg.type ?? "(untyped)";
      const slot = (stats.byType[type] ??= { count: 0, bytes: 0 });
      slot.count++;
      slot.bytes += raw.length;

      const patch = msg.patch ?? msg.effective;
      let entities = 0;
      if (patch && typeof patch === "object") {
        for (const [key, value] of Object.entries(patch)) {
          stats.patchKeys[key] = (stats.patchKeys[key] ?? 0) + 1;
          entities += value && typeof value === "object" ? Object.keys(value).length : 1;
        }
        stats.patchEntities.push(entities);
        const json = JSON.stringify(patch);
        if (json === stats.lastPatchJson) stats.identical++;
        stats.lastPatchJson = json;
      }
      stats.events.push({ at: performance.now(), type, bytes: raw.length, entities });
    });
    return ws;
  }
  Wrapped.prototype = Native.prototype;
  for (const k of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) Wrapped[k] = Native[k];
  window.WebSocket = Wrapped;
};

/** Counts server rejections and outbound patches on a guest. */
const GUEST_PROBE = () => {
  window.__g = { errors: {}, sentPatches: 0, acks: 0, checksums: 0, resyncs: 0 };
  const Native = window.WebSocket;
  function Wrapped(url, protocols) {
    const ws = protocols === undefined ? new Native(url) : new Native(url, protocols);
    const send = ws.send.bind(ws);
    ws.send = (data) => {
      try {
        const m = JSON.parse(String(data));
        if (m.type === "guest:patch" || m.type === "host:patch") window.__g.sentPatches++;
        if (m.type === "sync:request") window.__g.resyncs++;
      } catch {
        /* not json */
      }
      return send(data);
    };
    ws.addEventListener("message", (event) => {
      try {
        const m = JSON.parse(String(event.data));
        if (m.type === "error") {
          const c = m.code ?? "?";
          window.__g.errors[c] = (window.__g.errors[c] ?? 0) + 1;
        } else if (m.type === "OP_ACK") {
          window.__g.acks++;
        } else if (m.type === "sync:checksum") {
          window.__g.checksums++;
        }
      } catch {
        /* not json */
      }
    });
    return ws;
  }
  Wrapped.prototype = Native.prototype;
  for (const k of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) Wrapped[k] = Native[k];
  window.WebSocket = Wrapped;
};

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
    console.error("dev server nao encontrado — rode `npm run dev`");
    process.exit(1);
  }
  const seed = buildSeed(NODES);
  console.log(`\n=== TRAFEGO NO FIO (visto pelo host) — ${GUESTS} editores ===`);
  console.log(`app ${appUrl} | ${NODES} nos | ${DURATION_MS / 1000}s\n`);

  const browser = await chromium.launch({ headless: true });
  const hostCtx = await browser.newContext({ ignoreHTTPSErrors: true });
  await hostCtx.addInitScript(
    ([k, v]) => window.localStorage.setItem(k, v),
    [STORAGE_KEY, seed.payload],
  );
  await hostCtx.addInitScript(WIRE_PROBE);
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
    await ctx.addInitScript(GUEST_PROBE);
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
  console.log(`\n  medindo...\n`);

  await host.evaluate(() => {
    window.__dom = { attrWrites: 0, nodesTouched: new Set(), batches: 0 };
    const flow = document.querySelector(".react-flow__viewport");
    if (flow) {
      new MutationObserver((records) => {
        const d = window.__dom;
        d.batches++;
        for (const r of records) {
          if (r.type !== "attributes") continue;
          const el = r.target;
          if (el instanceof HTMLElement && el.classList.contains("react-flow__node")) {
            d.attrWrites++;
            d.nodesTouched.add(el.getAttribute("data-id"));
          }
        }
      }).observe(flow, { attributes: true, subtree: true, attributeFilter: ["style", "class"] });
    }
    const w = window;
    w.__fps = { frames: 0, longTasks: 0, blockedMs: 0, startedAt: performance.now() };
    const tick = () => {
      w.__fps.frames++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          w.__fps.longTasks++;
          w.__fps.blockedMs += e.duration;
          window.__wire?.longTasks.push({
            at: e.startTime,
            ms: Math.round(e.duration),
            from: (e.attribution ?? []).map((a) => a.name || a.containerType || "?").join(","),
          });
        }
      }).observe({ entryTypes: ["longtask"] });
    } catch {
      /* longtask unsupported */
    }
  });

  // Reset so the join snapshots don't pollute the steady-state numbers.
  await host.evaluate(() => {
    const s = window.__wire;
    s.startedAt = Date.now();
    s.total = { count: 0, bytes: 0 };
    s.byType = {};
    s.patchEntities = [];
    s.patchKeys = {};
    s.identical = 0;
    s.events = [];
    s.longTasks = [];
  });

  const deadline = Date.now() + DURATION_MS;
  const dragLog = guests.map(() => []);
  await Promise.all(
    guests.map(async (page, gi) => {
      while (Date.now() < deadline) {
        const id = pick(seed.componentIds);
        const ok = await dragNode(page, id, between(-140, 140), between(-110, 110));
        if (ok) dragLog[gi].push({ id, at: Date.now() });
        await sleep(between(150, 500));
      }
    }),
  );

  const wire = await host.evaluate(() => {
    const s = window.__wire;
    const seconds = (Date.now() - s.startedAt) / 1000;
    const ents = s.patchEntities;
    const sorted = [...ents].sort((a, b) => a - b);
    return {
      seconds,
      total: s.total,
      byType: s.byType,
      patchKeys: s.patchKeys,
      identical: s.identical,
      patches: ents.length,
      entMean: ents.length ? ents.reduce((a, b) => a + b, 0) / ents.length : 0,
      entMax: sorted.length ? sorted[sorted.length - 1] : 0,
      entP50: sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : 0,
    };
  });

  // Convergence by content, not by node count: hash what each page actually
  // renders, so a diagram that agrees on how many nodes exist but disagrees on
  // where they are still shows up.
  const positions = (page) =>
    page.evaluate(() => {
      const out = {};
      for (const el of document.querySelectorAll(".react-flow__node")) {
        const m = (el.style.transform || "").match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        out[el.getAttribute("data-id")] = m
          ? [Math.round(Number(m[1])), Math.round(Number(m[2]))]
          : [0, 0];
      }
      return out;
    });

  // What the store believes, as opposed to what React Flow currently paints.
  // A mismatch between the two is a rendering bug; a mismatch between stores is
  // a data bug. They need telling apart.
  const storePositions = (page) =>
    page.evaluate((key) => {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const state = parsed.state ?? parsed;
        const id = state.activeDiagramId;
        const diagram = state.diagrams?.[id];
        if (!diagram) return null;
        const out = {};
        for (const [nodeId, layout] of Object.entries(diagram.nodeLayouts ?? {})) {
          out[nodeId] = [Math.round(layout.x), Math.round(layout.y)];
        }
        return out;
      } catch {
        return null;
      }
    }, STORAGE_KEY);

  const compare = (hostPos, guestPos) => {
    const ids = new Set([...Object.keys(hostPos), ...Object.keys(guestPos)]);
    let differing = 0;
    let worst = 0;
    let example = null;
    let exampleId = null;
    for (const id of ids) {
      const a = hostPos[id];
      const b = guestPos[id];
      if (!a || !b) {
        differing++;
        continue;
      }
      const d = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
      if (d > 1) {
        differing++;
        if (d > worst) {
          worst = d;
          example = `${id} host(${a}) guest(${b})`;
          exampleId = id;
        }
      }
    }
    return { differing, worst, example, exampleId, total: ids.size };
  };

  // Divergence is only real if it survives quiet time — an early read races
  // the last patches and invents defects that are not there.
  // The host is just another client, so it cannot be the reference. A guest
  // that joins now gets the server's snapshot: that is the authority.
  const freshObserver = async () => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(link, { waitUntil: "domcontentloaded" });
    await page
      .getByPlaceholder(/e\.g\. Alex|ex\.: Alex/i)
      .first()
      .fill("Truth");
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
    await sleep(2500);
    return page;
  };

  const report = async (label, waitMs) => {
    await sleep(waitMs);
    const hostPos = await positions(host);
    const guestPos = await Promise.all(guests.map(positions));
    const diffs = guestPos.map((g) => compare(hostPos, g));
    const bad = diffs.filter((d) => d.differing > 0);
    console.log(
      `convergencia (${label}): ${diffs.length - bad.length}/${diffs.length} convidados identicos ao host`,
    );
    for (const [i, d] of diffs.entries()) {
      if (d.differing > 0) {
        const mine = dragLog[i] ?? [];
        const last = mine[mine.length - 1];
        const rank = [...mine].reverse().findIndex((x) => x.id === d.exampleId);
        console.log(
          `  guest ${i + 1}: ${d.differing}/${d.total} nos diferentes, maior desvio ${d.worst}px — ${d.example}`,
        );
        const g = await guests[i].evaluate(() => window.__g ?? null);
        console.log(
          `      ultimo arrasto proprio: ${last?.id ?? "-"} | ` +
            `o no divergente foi o ${rank === -1 ? "NUNCA arrastado por ele" : `${rank + 1}o mais recente dele`}`,
        );
        if (g) {
          console.log(
            `      enviou ${g.sentPatches} patches, ${g.acks} acks, erros: ${JSON.stringify(g.errors)}`,
          );
        }
      }
    }
    return bad.length;
  };

  const allErrors = {};
  let totalSent = 0;
  let totalAcks = 0;
  let totalChecksums = 0;
  let totalResyncs = 0;
  for (const page of guests) {
    const g = await page.evaluate(() => window.__g ?? null);
    if (!g) continue;
    totalSent += g.sentPatches;
    totalAcks += g.acks;
    totalChecksums += g.checksums;
    totalResyncs += g.resyncs;
    for (const [c, n] of Object.entries(g.errors)) allErrors[c] = (allErrors[c] ?? 0) + n;
  }
  console.log(
    `convidados: ${totalSent} patches enviados, ${totalAcks} acks, rejeicoes ${JSON.stringify(allErrors)}`,
  );
  console.log(
    `checksums recebidos: ${totalChecksums} | pedidos de resync: ${totalResyncs} ` +
      `(esperado 0 numa sessao sem deriva)\n`,
  );

  const badEarly = await report("4s de silencio", 4000);
  const badLate = await report("12s de silencio", 8000);

  // Who is actually wrong: the host, or the guests?
  const truthPage = await freshObserver();
  const truth = await positions(truthPage);
  const hostVsTruth = compare(truth, await positions(host));
  console.log(
    `\nhost vs servidor: ${hostVsTruth.differing}/${hostVsTruth.total} nos diferentes` +
      (hostVsTruth.example ? ` — ${hostVsTruth.example}` : ""),
  );
  let guestsWrong = 0;
  for (const [i, page] of guests.entries()) {
    const d = compare(truth, await positions(page));
    if (d.differing > 0) {
      guestsWrong++;
      console.log(`  guest ${i + 1} vs servidor: ${d.differing} diferentes — ${d.example}`);
    }
  }
  console.log(
    `resumo: host ${hostVsTruth.differing === 0 ? "BATE" : "NAO BATE"} com o servidor | ` +
      `${guestsWrong}/${guests.length} convidados divergem do servidor (pelo DOM)\n`,
  );

  // Same question, asked of the stores.
  const truthStore = await storePositions(truthPage);
  if (!truthStore) {
    console.log("nao consegui ler o store persistido — comparacao so pelo DOM\n");
  } else {
    let storeWrong = 0;
    let renderOnly = 0;
    for (const [i, page] of guests.entries()) {
      const gStore = await storePositions(page);
      const gDom = await positions(page);
      if (!gStore) continue;
      const dStore = compare(truthStore, gStore);
      const dDom = compare(truthStore, gDom);
      if (dStore.differing > 0) {
        storeWrong++;
        console.log(`  guest ${i + 1} STORE difere: ${dStore.differing} — ${dStore.example}`);
      } else if (dDom.differing > 0) {
        renderOnly++;
        console.log(
          `  guest ${i + 1} store OK mas DOM difere: ${dDom.differing} — ${dDom.example}`,
        );
      }
    }
    console.log(
      `\nveredito: ${storeWrong}/${guests.length} com divergencia de DADO | ` +
        `${renderOnly}/${guests.length} apenas de RENDERIZACAO\n`,
    );
  }
  console.log(
    badEarly > 0 && badLate === 0
      ? "\n  => era corrida de medicao: convergiu sozinho\n"
      : badLate > 0
        ? "\n  => divergencia PERSISTENTE: nao converge com o tempo\n"
        : "\n  => convergiu\n",
  );

  const kb = (b) => (b / 1024).toFixed(1) + "KB";
  console.log(`janela: ${wire.seconds.toFixed(1)}s\n`);
  console.log(
    "tipo".padEnd(24) +
      "msgs".padStart(8) +
      "msg/s".padStart(9) +
      "bytes".padStart(11) +
      "KB/s".padStart(9) +
      "media B".padStart(10),
  );
  console.log("-".repeat(71));
  const rows = Object.entries(wire.byType).sort((a, b) => b[1].bytes - a[1].bytes);
  for (const [type, s] of rows) {
    console.log(
      type.slice(0, 22).padEnd(24) +
        String(s.count).padStart(8) +
        (s.count / wire.seconds).toFixed(1).padStart(9) +
        kb(s.bytes).padStart(11) +
        (s.bytes / wire.seconds / 1024).toFixed(1).padStart(9) +
        Math.round(s.bytes / s.count)
          .toString()
          .padStart(10),
    );
  }
  console.log("-".repeat(71));
  console.log(
    "TOTAL".padEnd(24) +
      String(wire.total.count).padStart(8) +
      (wire.total.count / wire.seconds).toFixed(1).padStart(9) +
      kb(wire.total.bytes).padStart(11) +
      (wire.total.bytes / wire.seconds / 1024).toFixed(1).padStart(9),
  );

  console.log(`\npatches: ${wire.patches}`);
  console.log(
    `  entidades por patch: media ${wire.entMean.toFixed(1)} | p50 ${wire.entP50} | max ${wire.entMax}`,
  );
  console.log(`  chaves: ${JSON.stringify(wire.patchKeys)}`);
  console.log(`  patches identicos ao anterior: ${wire.identical}\n`);

  const fps = await host.evaluate(() => {
    const w = window;
    const seconds = (performance.now() - w.__fps.startedAt) / 1000;
    return {
      fps: +(w.__fps.frames / seconds).toFixed(1),
      longTasks: w.__fps.longTasks,
      blockedMs: Math.round(w.__fps.blockedMs),
      blockedPerSec: Math.round(w.__fps.blockedMs / seconds),
    };
  });
  console.log(
    `host: ${fps.fps} fps | ${fps.longTasks} long tasks | ${fps.blockedMs}ms bloqueado (${fps.blockedPerSec} ms/s)\n`,
  );

  // What arrived in the 120ms before each stall?
  const stalls = await host.evaluate(() => {
    const s = window.__wire;
    return s.longTasks
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 15)
      .map((t) => {
        const before = s.events.filter((e) => e.at > t.at - 120 && e.at <= t.at + t.ms);
        const byType = {};
        let ents = 0;
        let bytes = 0;
        for (const e of before) {
          byType[e.type] = (byType[e.type] ?? 0) + 1;
          ents += e.entities;
          bytes += e.bytes;
        }
        return {
          ms: t.ms,
          at: Math.round(t.at),
          from: t.from,
          msgs: before.length,
          ents,
          bytes,
          byType,
        };
      });
  });
  const dom = await host.evaluate(() => {
    const d = window.__dom;
    return d
      ? { attrWrites: d.attrWrites, touched: d.nodesTouched.size, batches: d.batches }
      : null;
  });
  if (dom) {
    console.log(
      `DOM: ${dom.attrWrites} escritas de atributo em nos | ` +
        `${dom.touched} nos distintos tocados | ${dom.batches} lotes de mutacao`,
    );
    console.log(`  escritas por patch: ${(dom.attrWrites / (wire.patches || 1)).toFixed(1)}\n`);
  }

  console.log("long tasks (maiores) e o que chegou nos 120ms anteriores:");
  console.log(
    "  ms".padEnd(8) +
      "msgs".padStart(6) +
      "ents".padStart(6) +
      "bytes".padStart(8) +
      "  composicao",
  );
  console.log("-".repeat(72));
  for (const t of stalls) {
    console.log(
      String(t.ms).padEnd(8) +
        String(t.msgs).padStart(6) +
        String(t.ents).padStart(6) +
        String(t.bytes).padStart(8) +
        "  " +
        JSON.stringify(t.byType),
    );
  }
  console.log("");

  await browser.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
