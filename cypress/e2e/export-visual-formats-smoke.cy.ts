/**
 * Smoke test for the visual exports (SVG / PNG) in the Export modal.
 *
 * Seeds a two-node diagram, opens Export from the toolbar's "more" menu,
 * swaps the default data formats for SVG + PNG, and checks both files land
 * in the downloads folder under the diagram's slug.
 */
const DIAGRAM_STORE_LOCAL_STORAGE_KEY = "structura_diagram-store";
const DIAGRAM_ID = "diag_export_visual_smoke";
const SLUG = "export-smoke";

function payload(): string {
  const a = { id: "cmp_a", name: "A", description: "", parentId: null, type: "system" };
  const b = { id: "cmp_b", name: "B", description: "", parentId: null, type: "system" };

  return JSON.stringify({
    state: {
      diagrams: {
        [DIAGRAM_ID]: {
          id: DIAGRAM_ID,
          name: "Export smoke",
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

describe("Export modal — visual formats", () => {
  beforeEach(() => {
    cy.visit(`/model/${DIAGRAM_ID}`, {
      onBeforeLoad(win) {
        win.localStorage.setItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY, payload());
      },
    });
    cy.get(".react-flow__node", { timeout: 60000 }).should("have.length", 2);
  });

  it("downloads SVG and PNG named after the diagram", () => {
    cy.get('button[aria-label="More options"]').click();
    cy.contains('[role="menuitem"]', "Export").click();

    // Defaults are JSON + Draw.io: swap them for the image formats.
    cy.get('[data-testid="export-format-json"]').click();
    cy.get('[data-testid="export-format-drawio"]').click();
    cy.get('[data-testid="export-format-svg"]').click();
    cy.get('[data-testid="export-format-png"]').click();
    cy.get('[data-testid="export-framing-viewport"]').click();

    cy.contains('[role="dialog"] button', /^Download/).click();

    const downloads = Cypress.config("downloadsFolder");
    cy.readFile(`${downloads}/${SLUG}.svg`, { timeout: 30000 }).should("contain", "<svg");
    cy.readFile(`${downloads}/${SLUG}.png`, "binary", { timeout: 30000 }).should(
      (content: string) => {
        expect(content.length, "png size").to.be.greaterThan(0);
      },
    );
  });
});
