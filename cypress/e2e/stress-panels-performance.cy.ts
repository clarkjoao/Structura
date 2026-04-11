import type { SeedResult } from "../support/seed-stress-diagram";

describe("Stress Performance: 500 elements — timing and stability", () => {
  let seed: SeedResult;

  before(() => {
    cy.seedAndVisitStress({ targetCount: 500, maxDepth: 6 }).then((s) => {
      seed = s;
    });
  });

  it("canvas shows a large set of nodes after seed", () => {
    cy.get(".react-flow__node").should("have.length.gte", 50);
  });

  it("node selection completes within budget", () => {
    cy.getNode(seed.leafNodeIds[0]!)
      .should("exist")
      .then(($el) => {
        cy.window().then((win) => {
          const start = win.performance.now();
          cy.wrap($el)
            .click({ force: true })
            .then(() => {
              const elapsed = win.performance.now() - start;
              cy.task("log", `Node selection took ${elapsed.toFixed(0)}ms`);
              expect(elapsed).to.be.lessThan(2000);
            });
        });
      });
  });

  it("pane click completes within budget", () => {
    cy.getPane()
      .should("exist")
      .then(($pane) => {
        cy.window().then((win) => {
          const start = win.performance.now();
          cy.wrap($pane)
            .click({ force: true })
            .then(() => {
              const elapsed = win.performance.now() - start;
              cy.task("log", `Pane click took ${elapsed.toFixed(0)}ms`);
              expect(elapsed).to.be.lessThan(2000);
            });
        });
      });
  });

  it("fit view control completes within budget", () => {
    cy.get(".react-flow__controls-fitview")
      .should("exist")
      .then(($btn) => {
        cy.window().then((win) => {
          const start = win.performance.now();
          cy.wrap($btn)
            .click()
            .then(() => {
              cy.wait(800).then(() => {
                const elapsed = win.performance.now() - start;
                cy.task("log", `fitView control took ${elapsed.toFixed(0)}ms`);
                expect(elapsed).to.be.lessThan(8000);
              });
            });
        });
      });
  });

  it("idle period does not show fatal overlay text", () => {
    cy.wait(3000);
    cy.get("body").should("not.contain.text", "Maximum update depth exceeded");
  });

  it("rapid selection of many nodes stays stable", () => {
    const nodesToClick = seed.leafNodeIds.slice(0, 15);
    for (const nodeId of nodesToClick) {
      cy.getNode(nodeId).click({ force: true });
      cy.wait(40);
    }
    cy.get("body").should("not.contain.text", "Maximum update depth exceeded");
  });

  it("rapid undo does not surface infinite update errors", () => {
    cy.getNode(seed.leafNodeIds[0]!).click({ force: true });
    cy.dragNode(seed.leafNodeIds[0]!, 40, 40);
    cy.wait(300);
    for (let i = 0; i < 8; i++) {
      cy.get("body").type("{ctrl}z");
      cy.wait(80);
    }
    cy.get("body").should("not.contain.text", "Maximum update depth exceeded");
  });

  it("pan with configured pan button (right-drag) stays stable", () => {
    cy.getPane().trigger("pointerdown", {
      clientX: 500,
      clientY: 400,
      button: 2,
      force: true,
      pointerId: 2,
      pointerType: "mouse",
    });
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      cy.getPane().trigger("pointermove", {
        clientX: 500 + Math.cos(angle) * 120,
        clientY: 400 + Math.sin(angle) * 120,
        button: 2,
        force: true,
        pointerId: 2,
        pointerType: "mouse",
      });
      cy.wait(40);
    }
    cy.getPane().trigger("pointerup", {
      force: true,
      button: 2,
      pointerId: 2,
      pointerType: "mouse",
    });
    cy.get("body").should("not.contain.text", "Maximum update depth exceeded");
  });
});
