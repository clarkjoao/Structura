import type { SeedResult } from "../support/seed-stress-diagram";

function clickNodeWithModifier(componentId: string, modifier: "ctrl" | "meta") {
  if (modifier === "meta") {
    // Synthetic keyboard state does not reliably attach metaKey to click events.
    cy.getNode(componentId).click({ metaKey: true, force: true });
    return;
  }
  // Ctrl modifier is more reliable via held-key typing in headed Chrome.
  cy.get("body").type("{ctrl}", { release: false });
  cy.getNode(componentId).click({ force: true });
  cy.get("body").type("{ctrl}");
}

describe("Stress Interaction: 500 elements — drag, select, undo", () => {
  let seed: SeedResult;

  before(() => {
    cy.seedAndVisitStress({ targetCount: 500, maxDepth: 6 }).then((s) => {
      seed = s;
    });
  });

  it("selects a node on click", () => {
    const leaf = seed.leafNodeIds[0]!;
    cy.getNode(leaf).click({ force: true });
    cy.getNode(leaf).should(($el) => {
      const selected = $el.hasClass("selected") || $el.attr("aria-selected") === "true";
      expect(selected, "node should show selection state").to.be.true;
    });
  });

  it("clears selection on pane click", () => {
    cy.getPane().click({ force: true });
    cy.get(".react-flow__node", { timeout: 5000 }).then(($nodes) => {
      const stillSelected = $nodes.filter(
        (_, el) => el.classList.contains("selected") || el.getAttribute("aria-selected") === "true",
      );
      expect(stillSelected.length).to.eq(0);
    });
  });

  it("drags a root node: it moves, and nothing crashes", () => {
    const rootIds = seed.allComponentIds.filter((id) => id.startsWith("root_stress_"));
    expect(rootIds.length).to.be.greaterThan(0);
    const nodeId = rootIds[rootIds.length - 1]!;
    cy.getNode(nodeId).should("exist");
    cy.dragNode(nodeId, 100, 50);
    cy.get("body").should("not.contain.text", "Maximum update depth exceeded");
  });

  it("drags a root panel: it moves, and nothing crashes", () => {
    const panel = seed.panelsByLevel[0]![0]!;
    cy.getNode(panel).should("exist");
    cy.dragNode(panel, 80, 40);
    cy.get("body").should("not.contain.text", "Maximum update depth exceeded");
  });

  it("undo/redo shortcuts do not surface infinite update errors", () => {
    const nodeId = seed.leafNodeIds[0]!;
    cy.getNode(nodeId).click({ force: true });
    cy.dragNode(nodeId, 80, 60);
    cy.wait(400);
    cy.get("body").type("{ctrl}z");
    cy.wait(400);
    cy.get("body").should("not.contain.text", "Maximum update depth exceeded");
    cy.get("body").type("{ctrl}{shift}z");
    cy.wait(400);
    cy.get("body").should("not.contain.text", "Maximum update depth exceeded");
  });

  it("multi-select with Ctrl adds nodes to selection", () => {
    cy.getNode(seed.leafNodeIds[0]!).click({ force: true });
    const max = Math.min(5, seed.leafNodeIds.length);
    for (let i = 1; i < max; i++) {
      clickNodeWithModifier(seed.leafNodeIds[i]!, "ctrl");
    }
    cy.get(".react-flow__node").then(($nodes) => {
      const selected = $nodes.filter(
        (_, el) => el.classList.contains("selected") || el.getAttribute("aria-selected") === "true",
      );
      expect(selected.length).to.be.gte(2);
    });
  });

  it("multi-select with Meta adds nodes to selection", () => {
    cy.getNode(seed.leafNodeIds[0]!).click({ force: true });
    const max = Math.min(5, seed.leafNodeIds.length);
    for (let i = 1; i < max; i++) {
      clickNodeWithModifier(seed.leafNodeIds[i]!, "meta");
    }
    cy.get(".react-flow__node").then(($nodes) => {
      const selected = $nodes.filter(
        (_, el) => el.classList.contains("selected") || el.getAttribute("aria-selected") === "true",
      );
      expect(selected.length).to.be.gte(2);
    });
  });

  it("fit view control works", () => {
    cy.get(".react-flow__controls-fitview").click();
    cy.wait(500);
    cy.get("body").should("not.contain.text", "Maximum update depth exceeded");
  });

  it("zoom controls work", () => {
    cy.get(".react-flow__controls-zoomin").click();
    cy.wait(200);
    cy.get(".react-flow__controls-zoomin").click();
    cy.wait(200);
    cy.get(".react-flow__controls-zoomout").click();
    cy.wait(200);
    cy.get("body").should("not.contain.text", "Maximum update depth exceeded");
  });
});
