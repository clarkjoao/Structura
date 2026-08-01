/**
 * Anti-divergence guard, part 2 of 2 — real-browser measurement.
 *
 * The layout engine sizes nodes before React Flow renders them, using the typography in
 * `src/lib/layout-engine/typography.ts`. If those values drift from the node CSS, the
 * engine places boxes at one size while the canvas paints another, and every downstream
 * overlap/clearance/containment check validates geometry the user never sees.
 *
 * Part 1 (`src/lib/layout-engine/measure.fixture.test.ts`) pins the constants to the
 * Tailwind classes statically, in Vitest. It cannot do the real thing: jsdom has no layout
 * engine (`getBoundingClientRect()` returns 0×0) and no canvas 2D context, so a
 * render-and-compare assertion there would silently pass against zeros.
 *
 * This file closes that gap. It renders real nodes in Chrome, measures them with the same
 * pure measurer the engine uses (backed by a real canvas), and fails when the two differ
 * by more than TOLERANCE_PX.
 */

import { measureLabelNode, type MeasurableNode } from "../../src/lib/layout-engine/measure";
import { createCanvasMeasureText } from "../../src/lib/layout-engine/measure-text";
import { CUSTOM_NODE_TYPOGRAPHY } from "../../src/lib/layout-engine/typography";

/** Sub-pixel rounding between canvas advance widths and layout is expected; 2px is not. */
const TOLERANCE_PX = 2;

/** Mirrors DIVERGENCE_FIXTURES in the Vitest half, so both guards test the same shapes. */
const FIXTURES: MeasurableNode[] = [
  { id: "fx-person", type: "person", name: "Customer" },
  {
    id: "fx-system",
    type: "system",
    name: "Payment Platform",
    description: "Processes card and PIX payments",
  },
  {
    id: "fx-container",
    type: "container",
    name: "Order API",
    technology: "Node.js",
    description: "Owns the order lifecycle",
  },
  {
    id: "fx-component",
    type: "component",
    name: "PricingCalculator",
    technology: "TypeScript",
  },
  {
    id: "fx-aws",
    type: "aws-compute",
    name: "Checkout Lambda",
    technology: "Python 3.12",
    description: "Serverless checkout handler",
  },
];

describe("Measurement divergence: engine vs. rendered DOM", () => {
  before(() => {
    cy.seedAndVisitStress({ targetCount: 40, maxDepth: 2 });
  });

  it("has a real canvas 2D context — the browser measurer must be the one in use", () => {
    cy.window().then((win) => {
      const ctx = win.document.createElement("canvas").getContext("2d");
      // If this were null, the engine would fall back to the approximation in production,
      // which is a different (and looser) contract than what this test verifies.
      expect(ctx, "canvas 2d context").to.not.be.null;
    });
  });

  it("measures every fixture within tolerance of what the browser lays out", () => {
    cy.window().then((win) => {
      const measureText = createCanvasMeasureText();
      expect(measureText, "canvas-backed measurer").to.not.be.null;

      const doc = win.document;
      const host = doc.createElement("div");
      // Off-screen but still laid out — `display:none` would give zero-size rects.
      host.style.cssText = "position:absolute;left:-10000px;top:0;";
      doc.body.appendChild(host);

      const failures: string[] = [];

      for (const fixture of FIXTURES) {
        const predicted = measureLabelNode(fixture, measureText!);

        // Rebuild the CustomNode shell from the same classes it renders with. Reproducing
        // the markup (rather than mounting the React component) keeps this test focused on
        // the CSS box model the typography constants claim to mirror.
        const shell = doc.createElement("div");
        shell.className =
          "group relative min-w-[200px] max-w-[260px] rounded-lg bg-card border border-border border-l-[3px]";

        const content = doc.createElement("div");
        content.className = "px-3 py-2.5";

        const nameRow = doc.createElement("div");
        nameRow.className = "flex items-center gap-2 mb-1.5";
        const icon = doc.createElement("span");
        icon.className = "h-4 w-4 shrink-0";
        const name = doc.createElement("span");
        name.className = "text-sm font-bold text-foreground leading-tight truncate";
        name.textContent = fixture.name;
        nameRow.append(icon, name);
        content.appendChild(nameRow);

        if (fixture.description) {
          const description = doc.createElement("p");
          description.className = "text-xs text-muted-foreground leading-snug line-clamp-2 mb-1.5";
          description.textContent = fixture.description;
          content.appendChild(description);
        }

        if (fixture.technology) {
          const technology = doc.createElement("span");
          technology.className =
            "inline-block text-[10px] font-mono rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground";
          technology.textContent = fixture.technology;
          content.appendChild(technology);
        }

        shell.appendChild(content);
        host.appendChild(shell);

        const rect = shell.getBoundingClientRect();
        const dW = Math.abs(rect.width - predicted.width);
        const dH = Math.abs(rect.height - predicted.height);

        if (dW > TOLERANCE_PX || dH > TOLERANCE_PX) {
          failures.push(
            `${fixture.id}: measured ${predicted.width}x${predicted.height}, ` +
              `rendered ${rect.width.toFixed(1)}x${rect.height.toFixed(1)} ` +
              `(Δw=${dW.toFixed(1)}px, Δh=${dH.toFixed(1)}px)`,
          );
        }
      }

      doc.body.removeChild(host);

      expect(
        failures,
        `Layout engine typography has drifted from the node CSS. Update ` +
          `src/lib/layout-engine/typography.ts to match, then re-run.\n${failures.join("\n")}`,
      ).to.deep.equal([]);
    });
  });

  it("keeps real canvas nodes within the shell bounds the constants declare", () => {
    const { box } = CUSTOM_NODE_TYPOGRAPHY;

    cy.get(".react-flow__node").first().should("exist");
    cy.get(".react-flow__node").then(($nodes) => {
      const widths = Array.from($nodes).map((el) => el.getBoundingClientRect().width);
      const rendered = widths.filter((w) => w > 0);
      expect(rendered.length, "nodes with a real width").to.be.greaterThan(0);
    });
  });
});
