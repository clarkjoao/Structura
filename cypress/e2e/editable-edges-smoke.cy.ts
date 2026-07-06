/**
 * Runtime smoke for the rebuilt editable edges. Loads a minimal persisted (v4)
 * workspace whose single connection uses the Editable style and carries a legacy
 * `waypoints` edge layout, so the load also exercises the v4→v6 migration
 * (waypoints → control points). Confirms the edge renders with the new
 * EditableEdge and that selecting it reveals control-point affordances.
 * Cypress fails the run on any uncaught app exception.
 */
const DIAGRAM_STORE_LOCAL_STORAGE_KEY = "structura_diagram-store";
const DIAGRAM_ID = "diag_editable_smoke";
const CONN_ID = "conn_editable_smoke";

function buildPayload(): string {
  const component = (id: string, name: string, x: number) => ({
    node: { id, name, description: "", parentId: null, type: "system" },
    layout: { elementId: id, x, y: 200 },
  });
  const a = component("cmp_a", "A", 120);
  const b = component("cmp_b", "B", 620);

  const diagram = {
    id: DIAGRAM_ID,
    name: "Editable Smoke",
    domain: "",
    level: "context",
    description: "",
    snapshot: {
      components: { [a.node.id]: a.node, [b.node.id]: b.node },
      connections: {
        [CONN_ID]: {
          id: CONN_ID,
          sourceId: a.node.id,
          targetId: b.node.id,
          label: "uses",
          style: { edgeStyle: "editable" },
        },
      },
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: { [a.node.id]: a.layout, [b.node.id]: b.layout },
    // Legacy array-of-records shape with waypoints — migrated to control points.
    edgeLayouts: [{ connectionId: CONN_ID, waypoints: [{ x: 370, y: 120 }] }],
    viewport: { x: 0, y: 0, zoom: 1 },
    scenes: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return JSON.stringify({
    state: {
      diagrams: { [DIAGRAM_ID]: diagram },
      folders: {},
      userTemplates: {},
      serviceRegistry: {},
      activeDiagramId: DIAGRAM_ID,
      past: [],
      future: [],
      _lastUndoRedoAt: 0,
    },
    version: 4,
  });
}

describe("Editable edges smoke", () => {
  const consoleErrors: string[] = [];

  before(() => {
    cy.visit(`/model/${DIAGRAM_ID}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY, buildPayload());
        cy.stub(win.console, "error").callsFake((...args: unknown[]) => {
          consoleErrors.push(args.map(String).join(" "));
        });
      },
    });
    cy.get(".react-flow__node", { timeout: 60000 }).should("have.length.gte", 2);
  });

  it("renders the connection with the new edge component", () => {
    cy.get(".react-flow__edge", { timeout: 20000 }).its("length").should("be.gte", 1);
  });

  it("reveals control points after migration when the edge is selected", () => {
    cy.get(".react-flow__edge-interaction").first().click({ force: true });
    // The migrated waypoint became a control point; selection renders it.
    cy.get('circle[aria-label^="Control point"]', { timeout: 15000 })
      .its("length")
      .should("be.gte", 1);
    // Ghost "add point" affordances also appear on the selected editable edge.
    cy.get('circle[aria-label="Add a control point here"]').its("length").should("be.gte", 1);
  });

  it("shows the edge toolbar with a reset action for the editable edge", () => {
    cy.get('button[aria-label="Reset edge shape"]', { timeout: 10000 }).should("exist");
  });

  it("logged no console errors during the flow", () => {
    cy.wrap(null).then(() => {
      expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).to.have.length(0);
    });
  });
});
