/**
 * A guided diagram end to end (openspec guided-flow-diagram): a journey built
 * from the keyboard across three lanes with a decision, laid out by the kind
 * and never dragged; then the round trip — edited freehand, where nodes drag,
 * and back to guided, where the arrangement takes over again.
 */
const DIAGRAM_STORE_LOCAL_STORAGE_KEY = "structura_diagram-store";
const DIAGRAM_ID = "diag_guided_smoke";

function lane(id: string, name: string, index: number) {
  return {
    id,
    name,
    description: "",
    parentId: null,
    type: "panel",
    panelKind: "swimlane",
    swimlane: { orientation: "horizontal", laneLabel: name, laneColor: "#6366f1" },
    _layout: { elementId: id, x: 0, y: index * 200, width: 1400, height: 200 },
  };
}

function payload(): string {
  const lanes = [
    lane("lane_user", "User", 0),
    lane("lane_app", "App", 1),
    lane("lane_api", "API", 2),
  ];
  const start = {
    id: "step_start",
    name: "Start",
    description: "",
    parentId: "lane_user",
    type: "process-node",
    flowShape: "start",
  };
  const components: Record<string, unknown> = { step_start: start };
  const nodeLayouts: Record<string, unknown> = {
    step_start: { elementId: "step_start", x: 84, y: 72, width: 56, height: 56 },
  };
  for (const l of lanes) {
    const { _layout, ...component } = l;
    components[l.id] = component;
    nodeLayouts[l.id] = _layout;
  }
  return JSON.stringify({
    state: {
      diagrams: {
        [DIAGRAM_ID]: {
          id: DIAGRAM_ID,
          name: "Checkout",
          domain: "",
          level: "context",
          description: "",
          kind: "guided",
          snapshot: { components, connections: {}, flows: {}, iconLibrary: {} },
          nodeLayouts,
          edgeLayouts: {},
          viewport: { x: 0, y: 0, zoom: 0.6 },
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

/** The canvas listens on the document in the capture phase. */
function press(key: string, mods: { shiftKey?: boolean; altKey?: boolean } = {}) {
  cy.document().trigger("keydown", { key, ...mods });
  // Let the kind watcher derive and arrange (≈50 ms debounce).
  cy.wait(150);
}

function renderedTranslate(style: string | undefined): { x: number; y: number } {
  const match = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(style ?? "");
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: NaN, y: NaN };
}

describe("guided diagram", () => {
  before(() => {
    cy.visit(`/model/${DIAGRAM_ID}?nodeId=step_start`, {
      onBeforeLoad(win) {
        win.localStorage.setItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY, payload());
      },
    });
    cy.get('[data-id="step_start"]', { timeout: 60000 }).should("exist");
  });

  it("builds a six-step journey with a decision across three lanes from the keyboard", () => {
    cy.get('[data-id="step_start"]').click({ force: true });
    press("Tab"); // Start → step 2 (User)
    press("ArrowDown", { altKey: true }); // step 2 → App
    press("Tab"); // step 3 (App)
    press("Tab", { shiftKey: true }); // decision after step 3, and a branch
    press("ArrowDown", { altKey: true }); // the branch → API
    press("Tab"); // step after the branch (API)

    cy.get('[data-testid="kind-mode-bar"]').should("contain.text", "Guided");
    // Start, three tasks, a decision, a branch step, one more: seven steps, three lanes.
    cy.get(".react-flow__node.kind-placed").should("have.length.at.least", 9);
    cy.get(".react-flow__edge").should("have.length.at.least", 5);
  });

  it("does not drag a step while guided", () => {
    cy.getNode("step_start")
      .invoke("attr", "style")
      .then((before) => {
        cy.dragNodeAllowingNoMove("step_start", 200, 200);
        cy.getNode("step_start")
          .invoke("attr", "style")
          .should((after) => {
            expect(renderedTranslate(after)).to.deep.equal(renderedTranslate(before));
          });
      });
  });

  it("drags freehand, and the arrangement takes over again on the return", () => {
    cy.contains("button", /Edit freehand|Editar livremente/).click();
    cy.getNode("step_start")
      .invoke("attr", "style")
      .then((before) => {
        const start = renderedTranslate(before);
        cy.dragNode("step_start", 0, 60);
        cy.getNode("step_start")
          .invoke("attr", "style")
          .should((after) => {
            expect(renderedTranslate(after).y).to.be.greaterThan(start.y);
          });
        cy.contains("button", /Back to guided|Voltar ao guiado/).click();
        cy.wait(300);
        cy.getNode("step_start")
          .invoke("attr", "style")
          .should((after) => {
            expect(renderedTranslate(after)).to.deep.equal(start);
          });
      });
    cy.get('[data-testid="kind-mode-bar"]').should("contain.text", "Guided");
  });
});
