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

      dragNodeAllowingNoMove(
        componentId: string,
        dx: number,
        dy: number,
      ): Chainable<string | undefined>;

      /** Which panel region owns the viewport point (x, y), via `elementFromPoint`. */
      hitRegionAt(x: number, y: number): Chainable<string>;

      /** Same, but the point is re-measured on every retry — use this in assertions. */
      assertHitRegion(
        pointOf: (doc: Document) => [number, number],
        expected: string,
        message?: string,
      ): Chainable<void>;

      /** `clickAt` against a point re-measured at click time. */
      clickAtPoint(pointOf: (doc: Document) => [number, number]): Chainable<void>;

      /** Real click at the viewport point (x, y) — no `force`, no coordinate guessing. */
      clickAt(x: number, y: number, options?: Partial<Cypress.ClickOptions>): Chainable<void>;

      /** Press-move-release from (x0, y0) to (x1, y1) with the moves spaced out. */
      dragFromPoint(
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        options?: { steps?: number; shiftKey?: boolean },
      ): Chainable<void>;
    }
  }
}

/**
 * Intervalo real entre os `mousemove` sintéticos de um arraste.
 *
 * Sem ele os seis eventos saem no mesmo tick e o React Flow processa quase
 * nenhum: medido em Cypress com `DRAG_THRESHOLD_PX = 0` e snap desligado, um
 * arraste de 3 px em rajada síncrona movia o nó **0 px**, enquanto o mesmo
 * gesto com 40 ms entre os eventos movia as 3,75 unidades de fluxo esperadas.
 * Era esse o segundo motivo — além do `snapGrid` — pelo qual os testes de
 * limiar não conseguiam falhar: o arraste que eles diziam exercitar não
 * chegava a acontecer.
 */
const DRAG_STEP_DELAY_MS = 30;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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

          cy.then(async () => {
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
              await delay(DRAG_STEP_DELAY_MS);
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
            await delay(DRAG_STEP_DELAY_MS);
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

Cypress.Commands.add("dragNodeAllowingNoMove", (componentId: string, dx: number, dy: number) => {
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

          cy.then(async () => {
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
              await delay(DRAG_STEP_DELAY_MS);
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
            await delay(DRAG_STEP_DELAY_MS);
          });
        });
      });

      // Unlike `dragNode`, do not assert the transform changed — Phase 4
      // threshold tests need to verify that sub-threshold drags DO NOT
      // move the node. That assertion is only worth anything because the
      // moves above are spaced by `DRAG_STEP_DELAY_MS`: a synchronous burst
      // moves nothing at all, which would make "did not move" vacuous.
      return cy.wrap(before, { log: false });
    });
});

/**
 * Names the panel region that actually owns a viewport point.
 *
 * This is the assertion `force: true` used to destroy. `cy.get(".panel-body")
 * .click({ force: true })` dispatches the event on an element the cursor could
 * never reach — the case that certified decision #1 passed for a year while
 * `.panel-body` laid out at 397x0 and every real click in the interior landed
 * on `.panel-border` and selected the panel. Asking `elementFromPoint` who is
 * on top is the only way a headless test can speak about geometry at all.
 */
/** The region name, plus enough detail to debug a miss, for one point. */
function regionAt(doc: Document, x: number, y: number): { region: string; detail: string } {
  const el = doc.elementFromPoint(x, y);
  if (!el) return { region: "(nothing)", detail: "elementFromPoint returned null" };
  const detail = `<${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}">`;
  const nodeId = el.closest(".react-flow__node")?.getAttribute("data-id") ?? null;
  if (el.closest(".react-flow__resize-control")) return { region: "resize-handle", detail };
  if (el.closest(".panel-header")) return { region: "panel-header", detail };
  if (el.closest(".panel-border")) return { region: "panel-border", detail };
  if (el.closest(".panel-body")) return { region: "panel-body", detail };
  if (nodeId) return { region: `node:${nodeId}`, detail };
  if (el.closest(".react-flow__pane")) return { region: "pane", detail };
  return { region: `other:${el.tagName.toLowerCase()}`, detail };
}

Cypress.Commands.add("hitRegionAt", (x: number, y: number) =>
  cy.document({ log: false }).then((doc) => cy.wrap(regionAt(doc, x, y).region, { log: false })),
);

/**
 * Asserts the region under a point that is RE-MEASURED on every retry.
 *
 * `cy.hitRegionAt(x, y).should(...)` resolves the coordinates once and then
 * retries the comparison against a frozen point. That is a real trap on this
 * canvas: the viewport is still settling right after `waitForCanvas`, and the
 * element panel opening on the right reflows everything. A point measured a
 * frame too early keeps being re-checked at coordinates the panel has already
 * left, and the failure reads as a geometry bug when it is a timing one — it
 * cost one intermittent red in this suite before the command existed.
 *
 * `pointOf` receives the live document, so each retry re-reads the rects.
 */
Cypress.Commands.add(
  "assertHitRegion",
  (pointOf: (doc: Document) => [number, number], expected: string, message?: string) => {
    cy.document({ log: false }).should((doc) => {
      const [x, y] = pointOf(doc);
      const { region, detail } = regionAt(doc, x, y);
      expect(
        region,
        `${message ? `${message}: ` : ""}region at (${Math.round(x)}, ${Math.round(y)}) — top element ${detail}`,
      ).to.equal(expected);
    });
  },
);

/** `clickAt` against a point re-measured at click time, for the same reason. */
Cypress.Commands.add("clickAtPoint", (pointOf: (doc: Document) => [number, number]) => {
  cy.document({ log: false }).then((doc) => {
    const [x, y] = pointOf(doc);
    cy.clickAt(x, y);
  });
});

/**
 * Clicks the element that is genuinely on top at (x, y), at that exact point.
 *
 * Deliberately NOT `cy.get(selector).click({ force: true })`: the whole defect
 * this suite exists for was invisible to forced clicks. Here Cypress still runs
 * its actionability checks — the subject is the element `elementFromPoint`
 * returned, so if anything covers the point, or the element has collapsed to
 * zero size, the command fails instead of pretending.
 */
Cypress.Commands.add("clickAt", (x: number, y: number, options = {}) => {
  cy.document({ log: false }).then((doc) => {
    const el = doc.elementFromPoint(x, y) as HTMLElement | null;
    expect(el, `an element must exist at viewport point (${x}, ${y})`).to.not.equal(null);
    const rect = (el as HTMLElement).getBoundingClientRect();
    cy.wrap(el as HTMLElement, { log: false }).click(x - rect.left, y - rect.top, options);
  });
});

/**
 * A drag that React Flow actually processes.
 *
 * Three things are load-bearing and each one was learned by watching a test
 * pass while exercising nothing:
 *  - `pointerdown`, not just `mousedown`. React Flow arms its marquee from
 *    `onPointerDownCapture` on the pane; a mousedown-only gesture starts no
 *    selection rectangle at all.
 *  - `view` on the mouse events, because d3's `nodrag` reads
 *    `event.view.document` and throws without it.
 *  - `DRAG_STEP_DELAY_MS` between moves. A synchronous burst of six moves
 *    moves a node 0 px; the same gesture spaced out moves the expected amount.
 */
Cypress.Commands.add(
  "dragFromPoint",
  (x0: number, y0: number, x1: number, y1: number, options = {}) => {
    const steps = options.steps ?? 10;
    const shiftKey = options.shiftKey ?? false;
    cy.window({ log: false }).then((win) => {
      cy.document({ log: false }).then((doc) => {
        const target = doc.elementFromPoint(x0, y0) as HTMLElement | null;
        expect(target, `an element must exist at drag origin (${x0}, ${y0})`).to.not.equal(null);
        const el = target as HTMLElement;
        const w = win as unknown as Window & {
          PointerEvent: typeof PointerEvent;
          MouseEvent: typeof MouseEvent;
        };
        const pointer = (type: string, x: number, y: number, buttons: number) =>
          new w.PointerEvent(type, {
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
            clientX: x,
            clientY: y,
            button: 0,
            buttons,
            shiftKey,
            bubbles: true,
            cancelable: true,
            composed: true,
            view: win as unknown as Window,
          });
        const mouse = (type: string, x: number, y: number, buttons: number) =>
          new w.MouseEvent(type, {
            clientX: x,
            clientY: y,
            button: 0,
            buttons,
            shiftKey,
            bubbles: true,
            cancelable: true,
            view: win as unknown as Window,
          });

        cy.then(async () => {
          el.dispatchEvent(pointer("pointerdown", x0, y0, 1));
          el.dispatchEvent(mouse("mousedown", x0, y0, 1));
          await delay(DRAG_STEP_DELAY_MS);
          for (let i = 1; i <= steps; i += 1) {
            const x = x0 + ((x1 - x0) * i) / steps;
            const y = y0 + ((y1 - y0) * i) / steps;
            // Dispatch on the press target, not on `window`: React Flow's
            // marquee listens with a React `onPointerMove` on the pane, and a
            // window-level dispatch never enters the React tree at all — that
            // alone was worth 0 marquee frames on an otherwise correct gesture.
            el.dispatchEvent(pointer("pointermove", x, y, 1));
            el.dispatchEvent(mouse("mousemove", x, y, 1));
            await delay(DRAG_STEP_DELAY_MS);
          }
          el.dispatchEvent(pointer("pointerup", x1, y1, 0));
          el.dispatchEvent(mouse("mouseup", x1, y1, 0));
          await delay(DRAG_STEP_DELAY_MS * 2);
        });
      });
    });
  },
);

export {};
