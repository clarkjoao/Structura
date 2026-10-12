/**
 * Live-collaboration stress: the browser hosts a session, a swarm of protocol bots (Node side,
 * `support/collab-swarm.ts`) edits the same room through one or more relays, and the browser
 * keeps working — single drags, select-all + duplicate + drag of everything — the whole time.
 *
 * The verdict comes from the relay, not from the browser: once the swarm is quiet, a fresh
 * observer reads the room's state and every node the browser draws must sit exactly where the
 * room says, with the name the room says. That is the property the users saw break (a peer's
 * move never reaching the canvas, positions diverging after a duplicated multi-selection).
 *
 * Needs the app and the relay(s) up:
 *   REDIS_URL=redis://localhost:6379 PORT=3000 npm run server:dev   # relay A
 *   REDIS_URL=redis://localhost:6379 PORT=3001 npm run server:dev   # relay B (optional)
 *   npx vite build && npx vite preview --port 4173                # measure the production build
 *   npm run cy:run:collab -- --env COLLAB_WS_EXTRA=ws://localhost:3001/ws,COLLAB_BOTS=6
 *
 * Kept out of `stress-*` on purpose: it needs running relays, the other stress specs do not.
 * Run it on the production build — React's development mode costs several times more per render
 * and moves the breaking point.
 *
 * Env: COLLAB_WS (the browser's relay), COLLAB_WS_EXTRA (comma list, bots spread across all),
 * COLLAB_BOTS (default 3), COLLAB_NODES (default 40), COLLAB_DURATION_MS (default 30000).
 */
import type { RoomSnapshot, SwarmReport } from "../support/collab-swarm";

const STORE_KEY = "structura_diagram-store";
const DIAGRAM_ID = "diag_collab_stress";

const WS_URL: string = Cypress.env("COLLAB_WS") ?? "ws://localhost:3000/ws";
const EXTRA_URLS: string[] = String(Cypress.env("COLLAB_WS_EXTRA") ?? "")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);
const BOT_URLS = [WS_URL, ...EXTRA_URLS];
const BOTS = Number(Cypress.env("COLLAB_BOTS") ?? 3);
const NODES = Number(Cypress.env("COLLAB_NODES") ?? 40);
const DURATION_MS = Number(Cypress.env("COLLAB_DURATION_MS") ?? 30_000);

function seedPayload(): string {
  const components: Record<string, unknown> = {};
  const nodeLayouts: Record<string, unknown> = {};
  const perRow = Math.ceil(Math.sqrt(NODES));
  for (let i = 0; i < NODES; i++) {
    const id = `cmp_${i}`;
    components[id] = { id, name: `Service ${i}`, description: "", parentId: null, type: "system" };
    nodeLayouts[id] = {
      elementId: id,
      x: 100 + (i % perRow) * 260,
      y: 100 + Math.floor(i / perRow) * 180,
    };
  }
  return JSON.stringify({
    state: {
      diagrams: {
        [DIAGRAM_ID]: {
          id: DIAGRAM_ID,
          name: "Collab stress",
          domain: "",
          level: "context",
          description: "",
          snapshot: { components, connections: {}, flows: {}, iconLibrary: {} },
          nodeLayouts,
          edgeLayouts: {},
          viewport: { x: 0, y: 0, zoom: 0.5 },
          versions: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      folders: {},
      userTemplates: {},
      services: {},
      activeDiagramId: DIAGRAM_ID,
      past: [],
      future: [],
      _lastUndoRedoAt: 0,
    },
    version: 11,
  });
}

/** The `translate(x, y)` React Flow renders a node at — its flow position for top-level nodes. */
function translateOf(el: Element): { x: number; y: number } {
  const match = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(el.getAttribute("style") ?? "");
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: NaN, y: NaN };
}

/** Every node the browser draws, against the room, retried until it holds or times out. */
function expectCanvasMatchesRoom(room: RoomSnapshot): void {
  const ids = Object.keys(room.nodeLayouts);
  cy.get(".react-flow__node", { timeout: 20_000 }).should(($nodes) => {
    const drawn = new Map<string, Element>();
    $nodes.each((_, el) => {
      const id = el.getAttribute("data-id");
      if (id) drawn.set(id, el);
    });
    expect([...drawn.keys()].sort(), "the browser draws exactly the room's nodes").to.deep.equal(
      [...ids].sort(),
    );
    const off: string[] = [];
    for (const id of ids) {
      const at = translateOf(drawn.get(id)!);
      const want = room.nodeLayouts[id]!;
      if (Math.abs(at.x - want.x) > 0.5 || Math.abs(at.y - want.y) > 0.5) {
        off.push(`${id}: canvas (${at.x}, ${at.y}) room (${want.x}, ${want.y})`);
      }
      const name = room.componentNames[id];
      if (name && !drawn.get(id)!.textContent?.includes(name)) {
        off.push(`${id}: name "${name}" not drawn`);
      }
    }
    expect(off, `${off.length} node(s) out of sync with the room`).to.deep.equal([]);
  });
}

type LagWindow = { __collabLag?: number[] };

/** Report how unresponsive the page was over the samples taken since `from`. */
function logLag(label: string, from: number): void {
  cy.window({ log: false }).then((win) => {
    const samples = ((win as unknown as LagWindow).__collabLag ?? []).slice(from);
    const sorted = [...samples].sort((a, b) => a - b);
    const at = (p: number) => Math.round(sorted[Math.floor((p / 100) * (sorted.length - 1))] ?? 0);
    cy.task("log", `${label}: page lag p50 ${at(50)}ms, p95 ${at(95)}ms, max ${at(100)}ms`);
  });
}

function lagSamples(): Cypress.Chainable<number> {
  return cy
    .window({ log: false })
    .then((win) => ((win as unknown as LagWindow).__collabLag ?? []).length);
}

function nodeIds(): Cypress.Chainable<string[]> {
  return cy
    .get(".react-flow__node")
    .then(($n) => $n.toArray().map((el) => el.getAttribute("data-id") ?? ""));
}

/** Drag whatever node `id` is, by (dx, dy), without asserting it moved: a bot may hold it. */
function dragBy(id: string, dx: number, dy: number): void {
  cy.get(`.react-flow__node[data-id="${id}"]`).then(($el) => {
    if ($el.length === 0) return;
    cy.dragNodeAllowingNoMove(id, dx, dy);
  });
}

describe("live collaboration under load", () => {
  let roomId = "";

  before(() => {
    cy.visit(`/model/${DIAGRAM_ID}`, {
      onBeforeLoad(win) {
        win.localStorage.clear();
        win.localStorage.setItem(STORE_KEY, seedPayload());
        win.localStorage.setItem("structura_language", "en");
        win.localStorage.setItem(
          "structura:collab",
          JSON.stringify({ userName: "Host", serverUrl: WS_URL }),
        );
        (win as unknown as { __structuraE2eDisableSnap?: boolean }).__structuraE2eDisableSnap =
          true;
        // How late a 100 ms timer fires is how long the page could not respond.
        const lag: number[] = [];
        (win as unknown as LagWindow).__collabLag = lag;
        let expected = win.performance.now() + 100;
        win.setInterval(() => {
          const now = win.performance.now();
          lag.push(Math.max(0, now - expected));
          expected = now + 100;
        }, 100);
      },
    });
    cy.get(".react-flow__node", { timeout: 60_000 }).should("have.length", NODES);

    cy.contains("button", "Live session").click();
    cy.get("#collab-name").should("have.value", "Host");
    cy.get("#collab-ws").should("have.value", WS_URL);
    cy.get('[role="dialog"] input')
      .filter((_, el) => (el as HTMLInputElement).value.includes("/collab/"))
      .invoke("val")
      .then((link) => {
        roomId = String(link).split("/collab/")[1]!.split(/[?#]/)[0]!;
        cy.task("log", `room ${roomId}`);
      });
    cy.contains('[role="dialog"] button', "Start session").click();
    cy.contains("1 online", { timeout: 20_000 }).should("be.visible");
  });

  after(() => {
    cy.task("collab:stopSwarm", null, { log: false });
  });

  it("draws a peer's move without any local action (the reported desync)", () => {
    const moves = { cmp_0: { x: 1500, y: 900 }, cmp_1: { x: 1700, y: 950 } };
    cy.task("collab:movePeerOnce", { url: BOT_URLS[BOT_URLS.length - 1], roomId, moves })
      .its("applied")
      .should("equal", true);
    cy.task<RoomSnapshot>("collab:readRoom", { url: WS_URL, roomId }).then((room) => {
      expect(room.nodeLayouts.cmp_0).to.deep.equal(moves.cmp_0);
      expectCanvasMatchesRoom(room);
    });
  });

  it(`stays in sync with ${BOTS} bots editing for ${DURATION_MS / 1000}s while the host works`, () => {
    cy.task("collab:startSwarm", { urls: BOT_URLS, roomId, bots: BOTS }, { timeout: 60_000 })
      .its("ready")
      .should("equal", BOTS);
    cy.contains(`${BOTS + 1} online`, { timeout: 20_000 }).should("be.visible");

    cy.task("log", "swarm up");
    let lagFrom = 0;
    lagSamples().then((n) => (lagFrom = n));
    const started = Date.now();
    const rounds = Math.max(1, Math.floor(DURATION_MS / 6_000));
    for (let round = 0; round < rounds; round++) {
      // Single drags on whatever the canvas holds right now.
      nodeIds().then((ids) => {
        for (let i = 0; i < 4; i++) {
          const id = ids[Math.floor(Math.random() * ids.length)]!;
          dragBy(id, Math.round(Math.random() * 200 - 100), Math.round(Math.random() * 160 - 80));
        }
      });
      cy.task("log", `round ${round}`);
      cy.task("log", "single drags done");
      // The reported gesture, once: select everything, duplicate, drag the whole selection.
      if (round === 0) {
        cy.get(".react-flow__pane").click(20, 20, { force: true });
        cy.get("body").type("{meta}a");
        cy.get(".react-flow__node.selected").should("have.length", NODES);
        cy.task("log", "select-all done, duplicating");
        cy.get("body").type("{meta}d");
        cy.get(".react-flow__node", { timeout: 20_000 }).should("have.length", NODES * 2);
        cy.task("log", "duplicated, dragging the selection");
        cy.get(".react-flow__node.selected")
          .first()
          .then(($el) => cy.dragNodeAllowingNoMove($el.attr("data-id")!, 140, 90));
        cy.task("log", "selection dragged");
      }
      // Select-all and drag the entire canvas — one batched lock for every node.
      if (round === 1) {
        cy.get("body").type("{meta}a");
        cy.get(".react-flow__node.selected")
          .first()
          .then(($el) => cy.dragNodeAllowingNoMove($el.attr("data-id")!, -60, 40));
        cy.get("body").type("{esc}");
      }
      cy.wait(1_500);
    }
    cy.then(() => {
      const left = DURATION_MS - (Date.now() - started);
      if (left > 0) cy.wait(left);
    });

    // Quiet, then wait out the lock TTL so nothing is mid-gesture when the room is read.
    cy.then(() => logLag("while editing", lagFrom));
    cy.task("log", "quieting");
    cy.task("collab:quietSwarm");
    cy.get(".react-flow__node.dragging").should("have.length", 0);
    cy.wait(4_000);

    cy.task<SwarmReport>("collab:stopSwarm", null, { timeout: 30_000 }).then((report) => {
      cy.task("log", JSON.stringify(report.totals, null, 2));
      expect(report.totals.patchesSent, "the swarm actually edited").to.be.greaterThan(BOTS * 50);
      expect(report.totals.errors, "no relay errors (rate limits, refusals)").to.deep.equal({});
      expect(report.totals.locksGranted, "batched group locks were granted").to.be.greaterThan(0);
    });

    // Everyone left at once, through two relays: the host must count the room as it is.
    cy.contains("1 online", { timeout: 20_000 }).should("be.visible");
    cy.wait(1_000);
    cy.task<RoomSnapshot>("collab:readRoom", { url: WS_URL, roomId }).then((room) => {
      cy.task("log", `room settled at version ${room.version}`);
      expect(room.participants, "only the host is left in the room").to.have.length(1);
      expect(Object.keys(room.nodeLayouts).length, "the duplicate reached the room").to.equal(
        NODES * 2,
      );
      expectCanvasMatchesRoom(room);
    });
  });
});
