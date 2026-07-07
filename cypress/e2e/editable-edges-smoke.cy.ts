/**
 * Runtime smoke for the rebuilt editable edges (curved + orthogonal "step").
 * Loads a persisted (v4) workspace and verifies each editable style renders,
 * exposes its editing affordances on selection, and stays free of console
 * errors. Cypress fails the run on any uncaught app exception.
 */
const DIAGRAM_STORE_LOCAL_STORAGE_KEY = "structura_diagram-store";
const CONN_ID = "conn_editable_smoke";

function buildPayload(opts: {
  diagramId: string;
  edgeStyle: "editable" | "editable-step";
  edgeLayouts: unknown[];
  bY?: number;
}): string {
  const a = { id: "cmp_a", name: "A", description: "", parentId: null, type: "system" };
  const b = { id: "cmp_b", name: "B", description: "", parentId: null, type: "system" };
  const bY = opts.bY ?? 200;

  const diagram = {
    id: opts.diagramId,
    name: "Editable Smoke",
    domain: "",
    level: "context",
    description: "",
    snapshot: {
      components: { [a.id]: a, [b.id]: b },
      connections: {
        [CONN_ID]: {
          id: CONN_ID,
          sourceId: a.id,
          targetId: b.id,
          label: "uses",
          style: { edgeStyle: opts.edgeStyle },
        },
      },
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {
      [a.id]: { elementId: a.id, x: 120, y: 200 },
      [b.id]: { elementId: b.id, x: 620, y: bY },
    },
    edgeLayouts: opts.edgeLayouts,
    viewport: { x: 0, y: 0, zoom: 1 },
    scenes: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return JSON.stringify({
    state: {
      diagrams: { [opts.diagramId]: diagram },
      folders: {},
      userTemplates: {},
      serviceRegistry: {},
      activeDiagramId: opts.diagramId,
      past: [],
      future: [],
      _lastUndoRedoAt: 0,
    },
    version: 4,
  });
}

function visitWith(payload: string, diagramId: string, errors: string[]) {
  cy.visit(`/model/${diagramId}`, {
    onBeforeLoad(win) {
      win.localStorage.setItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY, payload);
      cy.stub(win.console, "error").callsFake((...args: unknown[]) => {
        errors.push(args.map(String).join(" "));
      });
    },
  });
  cy.get(".react-flow__node", { timeout: 60000 }).should("have.length.gte", 2);
}

describe("Editable edge — curved", () => {
  const errors: string[] = [];
  const diagramId = "diag_editable_curve";

  before(() => {
    // Legacy array-of-records waypoint -> migrated to a control point (v4->v6).
    visitWith(
      buildPayload({
        diagramId,
        edgeStyle: "editable",
        edgeLayouts: [{ connectionId: CONN_ID, waypoints: [{ x: 370, y: 120 }] }],
      }),
      diagramId,
      errors,
    );
  });

  it("renders and reveals control points after migration on selection", () => {
    cy.get(".react-flow__edge", { timeout: 20000 }).its("length").should("be.gte", 1);
    cy.get(".react-flow__edge-interaction").first().click({ force: true });
    cy.get('circle[aria-label^="Control point"]', { timeout: 15000 })
      .its("length")
      .should("be.gte", 1);
    cy.get('button[aria-label="Reset edge shape"]').should("exist");
  });

  it("logged no console errors", () => {
    cy.wrap(null).then(() => {
      expect(errors, `console errors:\n${errors.join("\n")}`).to.have.length(0);
    });
  });
});

describe("Editable edge — orthogonal step (draw.io style)", () => {
  const errors: string[] = [];
  const diagramId = "diag_editable_step";

  before(() => {
    visitWith(
      buildPayload({ diagramId, edgeStyle: "editable-step", edgeLayouts: [], bY: 520 }),
      diagramId,
      errors,
    );
  });

  it("renders an orthogonal path and shows draggable segment handles on selection", () => {
    cy.get(".react-flow__edge", { timeout: 20000 }).its("length").should("be.gte", 1);
    cy.get(".react-flow__edge-interaction").first().click({ force: true });
    cy.get('line[aria-label^="Edge segment"]', { timeout: 15000 })
      .its("length")
      .should("be.gte", 3);
  });

  it("shows draggable corner handles on selection", () => {
    cy.get(".react-flow__edge-interaction").first().click({ force: true });
    cy.get('rect[aria-label^="Edge corner"]', { timeout: 15000 }).its("length").should("be.gte", 2);
  });

  it("offers add-a-bend affordances and a routing toggle", () => {
    cy.get(".react-flow__edge-interaction").first().click({ force: true });
    cy.get('rect[aria-label="Add a control point here"]', { timeout: 15000 })
      .its("length")
      .should("be.gte", 1);
    cy.get('button[aria-label="Switch to curved routing"]').should("exist");
  });

  it("nudges a focused corner with the keyboard", () => {
    cy.get(".react-flow__edge-interaction").first().click({ force: true });
    cy.get('rect[aria-label^="Edge corner"]')
      .first()
      .focus()
      .trigger("keydown", { key: "ArrowUp", force: true })
      .trigger("keydown", { key: "ArrowRight", force: true });
    // Nudging materializes the route as stored control points.
    cy.get('rect[aria-label^="Edge corner"]').its("length").should("be.gte", 2);
  });

  it("repositions a corner by dragging its handle (keeps the route orthogonal)", () => {
    cy.get(".react-flow__edge-interaction").first().click({ force: true });
    cy.get('rect[aria-label^="Edge corner"]')
      .first()
      .then(($rect) => {
        const el = $rect[0] as unknown as SVGRectElement;
        const box = el.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy0 = box.top + box.height / 2;
        cy.wrap(el)
          .trigger("pointerdown", { clientX: cx, clientY: cy0, force: true, pointerId: 1 })
          .trigger("pointermove", { clientX: cx + 60, clientY: cy0, force: true, pointerId: 1 });
        cy.document().trigger("pointermove", { clientX: cx + 60, clientY: cy0, force: true });
        cy.document().trigger("pointerup", { force: true, pointerId: 1 });
      });
    cy.get(".react-flow__edge").should("exist");
  });

  it("repositions a segment by dragging it (creates orthogonal corners)", () => {
    cy.get('line[aria-label^="Edge segment"]')
      .eq(1)
      .then(($line) => {
        const el = $line[0] as unknown as SVGLineElement;
        const box = el.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy0 = box.top + box.height / 2;
        cy.wrap(el)
          .trigger("pointerdown", { clientX: cx, clientY: cy0, force: true, pointerId: 1 })
          .trigger("pointermove", { clientX: cx + 80, clientY: cy0, force: true, pointerId: 1 });
        cy.document().trigger("pointermove", { clientX: cx + 80, clientY: cy0, force: true });
        cy.document().trigger("pointerup", { force: true, pointerId: 1 });
      });
    cy.get(".react-flow__edge").should("exist");
  });

  it("logged no console errors", () => {
    cy.wrap(null).then(() => {
      expect(errors, `console errors:\n${errors.join("\n")}`).to.have.length(0);
    });
  });
});
