import { buildStressSeed, DIAGRAM_STORE_LOCAL_STORAGE_KEY, type SeedResult } from "./seed-stress-diagram";

declare global {
  namespace Cypress {
    interface Chainable {
      seedAndVisitStress(options?: {
        targetCount?: number;
        maxDepth?: number;
      }): Chainable<SeedResult>;

      waitForCanvas(minNodes?: number): Chainable<void>;

      getNode(componentId: string): Chainable<JQuery<HTMLElement>>;

      getPane(): Chainable<JQuery<HTMLElement>>;

      dragNode(componentId: string, dx: number, dy: number): Chainable<void>;
    }
  }
}

Cypress.Commands.add("seedAndVisitStress", (options) => {
  const seed = buildStressSeed(options);
  cy.visit(`/model/${seed.diagramId}`, {
    onBeforeLoad(win) {
      win.localStorage.setItem(DIAGRAM_STORE_LOCAL_STORAGE_KEY, seed.localStoragePayload);
    },
  });
  cy.waitForCanvas(10);
  return cy.wrap(seed, { log: false });
});

Cypress.Commands.add("waitForCanvas", (minNodes = 1) => {
  cy.get(".react-flow__node", { timeout: 60000 }).should("have.length.gte", minNodes);
  cy.get(".react-flow__viewport", { timeout: 15000 }).should("exist");
});

Cypress.Commands.add("getNode", (componentId: string) =>
  cy.get(`[data-id="${componentId}"]`, { timeout: 20000 }),
);

Cypress.Commands.add("getPane", () => cy.get(".react-flow__pane", { timeout: 15000 }));

Cypress.Commands.add("dragNode", (componentId: string, dx: number, dy: number) => {
  cy.getNode(componentId).then(($node) => {
    const el = $node[0];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const steps = 5;

    cy.wrap(el).trigger("pointerdown", {
      clientX: startX,
      clientY: startY,
      button: 0,
      force: true,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    });

    for (let i = 1; i <= steps; i++) {
      cy.wrap(el).trigger("pointermove", {
        clientX: startX + (dx * i) / steps,
        clientY: startY + (dy * i) / steps,
        button: 0,
        force: true,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      });
    }

    cy.wrap(el).trigger("pointerup", {
      clientX: startX + dx,
      clientY: startY + dy,
      force: true,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    });
  });
});

export {};
