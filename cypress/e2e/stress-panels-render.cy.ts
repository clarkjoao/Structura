import type { SeedResult } from "../support/seed-stress-diagram";

describe("Stress Render: 500 elements with 6-level nested panels", () => {
  let seed: SeedResult;

  before(() => {
    cy.seedAndVisitStress({ targetCount: 500, maxDepth: 6 }).then((s) => {
      seed = s;
    });
  });

  it("renders the canvas without crashing", () => {
    cy.get(".react-flow__viewport").should("exist");
    cy.get(".react-flow__node").should("have.length.gte", 50);
  });

  it("renders panel nodes with correct data-id", () => {
    const firstPanel = seed.panelsByLevel[0]![0]!;
    cy.getNode(firstPanel).should("exist");
    cy.getNode(firstPanel).should("have.attr", "data-id", firstPanel);
  });

  it("renders leaf nodes inside deepest panels", () => {
    const deepLeaf = seed.leafNodeIds[0]!;
    cy.getNode(deepLeaf).should("exist");
  });

  it("fit view keeps canvas interactive", () => {
    cy.get(".react-flow__controls-fitview").click();
    cy.wait(500);
    cy.get(".react-flow__node").should("have.length.gte", 20);
  });

  it("renders edges between components", () => {
    cy.get(".react-flow__edge", { timeout: 60000 }).should("have.length.gte", 1);
  });

  it("displays panel names in the DOM", () => {
    const firstPanel = seed.panelsByLevel[0]![0]!;
    cy.getNode(firstPanel).should("contain.text", "Panel-L0-0");
  });

  it("no React infinite update overlay", () => {
    cy.get("body").should("not.contain.text", "Maximum update depth exceeded");
  });
});
