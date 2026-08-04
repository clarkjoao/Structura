import {
  buildStressSeed,
  DIAGRAM_STORE_LOCAL_STORAGE_KEY,
  type SeedResult,
} from "./seed-stress-diagram";

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

/**
 * Drags a node and asserts it actually moved.
 *
 * The previous implementation fired pointer events at the node and moved
 * nothing: React Flow drags through d3-drag, which starts on `mousedown`, so a
 * `pointerdown` was simply ignored. Every test using it passed while exercising
 * no drag at all — they only asserted "no crash".
 *
 * Two things are needed to make a synthetic drag take:
 *  - `mousedown`, not `pointerdown`; and
 *  - `view` on that event, because d3's `nodrag` reads `event.view.document`
 *    and Cypress omits `view` by default (it throws a TypeError without it).
 *
 * Moves are dispatched on the app's own window, since that is where d3 listens
 * for the rest of the gesture.
 *
 * Known limit: the synthetic `mouseup` does not end React Flow's gesture, so
 * the position is asserted on the rendered transform rather than on the store.
 * The drag itself is real — the node moves on screen.
 */
Cypress.Commands.add("dragNode", (componentId: string, dx: number, dy: number) => {
  cy.getNode(componentId)
    .invoke("attr", "style")
    .then((before) => {
      cy.window().then((win) => {
        cy.getNode(componentId).then(($node) => {
          const el = $node[0];
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const startX = rect.left + rect.width / 2;
          const startY = rect.top + rect.height / 2;
          const steps = 6;

          cy.wrap(el).trigger("mousedown", {
            clientX: startX,
            clientY: startY,
            button: 0,
            buttons: 1,
            view: win,
            force: true,
          });

          cy.then(() => {
            const appWindow = win as unknown as {
              MouseEvent: typeof MouseEvent;
              dispatchEvent: (event: Event) => boolean;
            };
            for (let i = 1; i <= steps; i += 1) {
              appWindow.dispatchEvent(
                new appWindow.MouseEvent("mousemove", {
                  clientX: startX + (dx * i) / steps,
                  clientY: startY + (dy * i) / steps,
                  button: 0,
                  buttons: 1,
                  bubbles: true,
                  cancelable: true,
                  view: win as unknown as Window,
                }),
              );
            }
            appWindow.dispatchEvent(
              new appWindow.MouseEvent("mouseup", {
                clientX: startX + dx,
                clientY: startY + dy,
                button: 0,
                buttons: 0,
                bubbles: true,
                cancelable: true,
                view: win as unknown as Window,
              }),
            );
          });
        });
      });

      // The whole point of the helper: prove the node moved.
      if (dx !== 0 || dy !== 0) {
        cy.getNode(componentId)
          .invoke("attr", "style")
          .should((after) => {
            expect(after, "node transform should change after a drag").to.not.equal(before);
          });
      }
    });
});

export {};
