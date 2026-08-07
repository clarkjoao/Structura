/**
 * Proves `cy.dragNode` actually drags.
 *
 * The helper it exercises used to fire pointer events, which React Flow ignores
 * — every test using it passed while moving nothing. This spec is small and
 * fast on purpose: it is the guard that keeps the helper honest, so the slow
 * stress specs can rely on it.
 */
const DIAGRAM_STORE_LOCAL_STORAGE_KEY = "structura_diagram-store";
const DIAGRAM_ID = "diag_drag_smoke";

function payload(): string {
  const a = { id: "cmp_a", name: "A", description: "", parentId: null, type: "system" };
  const b = { id: "cmp_b", name: "B", description: "", parentId: null, type: "system" };

  return JSON.stringify({
    state: {
      diagrams: {
        [DIAGRAM_ID]: {
          id: DIAGRAM_ID,
          name: "Drag smoke",
          domain: "",
          level: "context",
          description: "",
          snapshot: {
            components: { cmp_a: a, cmp_b: b },
            connections: {},
            flows: {},
            iconLibrary: {},
          },
          nodeLayouts: {
            cmp_a: { elementId: "cmp_a", x: 200, y: 200 },
            cmp_b: { elementId: "cmp_b", x: 700, y: 200 },
          },
          edgeLayouts: {},
          viewport: { x: 0, y: 0, zoom: 1 },
          scenes: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      folders: {},
      userTemplates: {},
      serviceRegistry: {},
      activeDiagramId: DIAGRAM_ID,
      past: [],
      future: [],
      _lastUndoRedoAt: 0,
    },
    version: 11,
  });
}

/** Reads the `translate(x, y)` React Flow renders the node at. */
function renderedTranslate(style: string | undefined): { x: number; y: number } {
  const match = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(style ?? "");
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: NaN, y: NaN };
}

describe("cy.dragNode", () => {
  beforeEach(() => {
    cy.visit(`/model/${DIAGRAM_ID}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY, payload());
      },
    });
    cy.get(".react-flow__node", { timeout: 60000 }).should("have.length", 2);
  });

  it("moves the node it is given", () => {
    cy.getNode("cmp_a")
      .invoke("attr", "style")
      .then((before) => {
        const start = renderedTranslate(before);
        expect(start.x, "seeded position").to.equal(200);

        cy.dragNode("cmp_a", 160, 100);

        cy.getNode("cmp_a")
          .invoke("attr", "style")
          .should((after) => {
            const moved = renderedTranslate(after);
            expect(moved.x, "x after drag").to.be.greaterThan(start.x);
            expect(moved.y, "y after drag").to.be.greaterThan(start.y);
          });
      });
  });

  it("leaves the other node where it was", () => {
    cy.getNode("cmp_b")
      .invoke("attr", "style")
      .then((before) => {
        cy.dragNode("cmp_a", 120, 80);
        cy.getNode("cmp_b")
          .invoke("attr", "style")
          .should((after) => {
            expect(renderedTranslate(after)).to.deep.equal(renderedTranslate(before));
          });
      });
  });
});
