/**
 * Live cursors land on the element their owner points at, whatever each side's zoom, and the
 * host can follow a peer. A Node-side peer (`support/collab-swarm.ts`) shares the browser's room.
 *
 * Needs the app and a relay up, like `collab-load.cy.ts`:
 *   npm run cy:run:collab -- --spec cypress/e2e/collab-cursors.cy.ts
 */

const STORE_KEY = "structura_diagram-store";
const DIAGRAM_ID = "diag_collab_cursors";
const WS_URL: string = Cypress.env("COLLAB_WS") ?? "ws://localhost:3000/ws";
const PEER = "Cursor Bot";

/** Six nodes far apart, so "over the node" cannot be satisfied by a neighbour. */
const LAYOUT: Record<string, { x: number; y: number }> = {
  cmp_0: { x: 0, y: 0 },
  cmp_1: { x: 600, y: 0 },
  cmp_2: { x: 1200, y: 0 },
  cmp_3: { x: 0, y: 500 },
  cmp_4: { x: 600, y: 500 },
  cmp_5: { x: 1200, y: 500 },
};

function seedPayload(): string {
  const components: Record<string, unknown> = {};
  const nodeLayouts: Record<string, unknown> = {};
  for (const [id, at] of Object.entries(LAYOUT)) {
    components[id] = { id, name: `Service ${id}`, description: "", parentId: null, type: "system" };
    nodeLayouts[id] = { elementId: id, ...at };
  }
  return JSON.stringify({
    state: {
      diagrams: {
        [DIAGRAM_ID]: {
          id: DIAGRAM_ID,
          name: "Collab cursors",
          domain: "",
          level: "context",
          description: "",
          snapshot: { components, connections: {}, flows: {}, iconLibrary: {} },
          nodeLayouts,
          edgeLayouts: {},
          viewport: { x: 100, y: 100, zoom: 0.8 },
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

const cursorEl = () => cy.get("[data-collab-cursor]", { timeout: 10_000 });

/** The peer's cursor tip is inside `id`'s box on screen, and the cursor keeps its screen size. */
function expectCursorOver(id: string): void {
  cy.get(`.react-flow__node[data-id="${id}"]`).then(($node) => {
    cursorEl().should(($cursor) => {
      const tip = $cursor[0]!.getBoundingClientRect();
      const box = $node[0]!.getBoundingClientRect();
      expect(tip.left, "tip x inside the node").to.be.within(box.left, box.right);
      expect(tip.top, "tip y inside the node").to.be.within(box.top, box.bottom);
      const arrow = $cursor[0]!.querySelector("svg")!.getBoundingClientRect();
      expect(arrow.width, "same size on screen at any zoom").to.be.closeTo(16, 1);
    });
  });
}

type Seen = Record<string, { x: number; y: number } | null>;

/**
 * Wait until the peer has received a host cursor inside `box` (flow coordinates). `cy.task` does
 * not retry, so poll; earlier frames from other gestures may arrive first.
 */
function expectHostCursorAtPeerWithin(
  box: { x: number; y: number; width: number; height: number },
  tries = 40,
): void {
  cy.task<Seen>("collab:pointerPeerSeen", null, { log: false }).then((seen) => {
    const host = Object.values(seen).find((cursor) => cursor !== null) ?? null;
    const inside =
      host !== null &&
      host.x >= box.x &&
      host.x <= box.x + box.width &&
      host.y >= box.y &&
      host.y <= box.y + box.height;
    if (inside) return;
    expect(
      tries,
      `host cursor ${JSON.stringify(host)} inside ${JSON.stringify(box)}`,
    ).to.be.greaterThan(0);
    cy.wait(250, { log: false }).then(() => expectHostCursorAtPeerWithin(box, tries - 1));
  });
}

function scaleOf(transform: string): number {
  return Number(/scale\(([\d.]+)\)/.exec(transform)?.[1] ?? NaN);
}

function viewportTransform(): Cypress.Chainable<string> {
  return cy.get(".react-flow__viewport").invoke("attr", "style") as Cypress.Chainable<string>;
}

describe("live cursors", () => {
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
      },
    });
    cy.get(".react-flow__node", { timeout: 60_000 }).should("have.length", 6);
    cy.contains("button", "Live session").click();
    cy.get('[role="dialog"] input')
      .filter((_, el) => (el as HTMLInputElement).value.includes("/collab/"))
      .invoke("val")
      .then((link) => {
        roomId = String(link).split("/collab/")[1]!.split(/[?#]/)[0]!;
      });
    cy.contains('[role="dialog"] button', "Start session").click();
    cy.contains("1 online", { timeout: 20_000 }).should("be.visible");
    cy.then(() => cy.task("collab:startPointerPeer", { url: WS_URL, roomId, name: PEER }));
    cy.contains("2 online", { timeout: 20_000 }).should("be.visible");
  });

  after(() => {
    cy.task("collab:stopPointerPeer", null, { log: false });
  });

  it("draws a peer's cursor on the element it points at, at any zoom", () => {
    cy.task("collab:movePointerPeer", { x: LAYOUT.cmp_4!.x + 20, y: LAYOUT.cmp_4!.y + 20 });
    expectCursorOver("cmp_4");

    cy.get(".react-flow__controls-zoomin").click().click().click();
    expectCursorOver("cmp_4");

    cy.get(".react-flow__controls-zoomout").click().click().click().click().click().click();
    expectCursorOver("cmp_4");
  });

  it("sends this cursor in the diagram's coordinates, not the screen's", () => {
    cy.get(`.react-flow__node[data-id="cmp_1"]`).then(($node) => {
      const box = $node[0]!.getBoundingClientRect();
      cy.get(".react-flow__pane").trigger("pointermove", {
        clientX: box.left + 10,
        clientY: box.top + 10,
        force: true,
      });
    });
    // Screen pixels would be nowhere near cmp_1's flow position at this zoom.
    expectHostCursorAtPeerWithin({ ...LAYOUT.cmp_1!, width: 200, height: 120 });
  });

  it("follows a peer until the host takes the canvas back", () => {
    let startZoom = 0;
    viewportTransform().then((t) => {
      startZoom = scaleOf(t);
    });
    cy.get(`button[aria-label="Follow ${PEER}"]`).click();
    cy.contains(`Following ${PEER}`).should("be.visible");

    // Far outside the current view: following brings it back on screen.
    cy.task("collab:movePointerPeer", { x: 4000, y: 3000 });
    cy.get(".react-flow").then(($pane) => {
      const pane = $pane[0]!.getBoundingClientRect();
      cursorEl().should(($cursor) => {
        const tip = $cursor[0]!.getBoundingClientRect();
        expect(tip.left, "followed cursor on screen (x)").to.be.within(pane.left, pane.right);
        expect(tip.top, "followed cursor on screen (y)").to.be.within(pane.top, pane.bottom);
      });
    });

    // Following pans; it keeps the host's zoom.
    viewportTransform().should((t) => {
      expect(scaleOf(t), "zoom held while following").to.be.closeTo(startZoom, 1e-6);
    });

    // Any gesture of the host's own stops following, and the view stays put after that.
    cy.get(".react-flow__pane").trigger("pointerdown", { force: true, button: 0 });
    cy.contains(`Following ${PEER}`).should("not.exist");
    cy.wait(400);
    viewportTransform().then((before) => {
      cy.task("collab:movePointerPeer", { x: -4000, y: -3000 });
      cy.wait(800);
      viewportTransform().should("equal", before);
    });
  });
});
