/**
 * Anti-divergence guard, part 1 of 2 — static contract.
 *
 * The layout engine measures nodes with the typography in `typography.ts`. If the node CSS
 * changes and those values don't, the engine silently places boxes at the wrong size and
 * every downstream overlap/clearance/containment check validates geometry the user never
 * sees. That is the single most expensive way for this subsystem to fail, so it gets two
 * independent guards:
 *
 *   1. THIS FILE (Vitest, headless) — pins the typography constants to the exact Tailwind
 *      classes `CustomNode` applies, and pins the measurer's behavioural invariants. Fails
 *      the moment the constants drift from the documented CSS contract.
 *
 *   2. `cypress/e2e/measure-divergence.cy.ts` (real browser) — renders real nodes and
 *      compares measured size against `getBoundingClientRect()` within a 2px tolerance.
 *
 * Both are needed because jsdom has no layout engine (`getBoundingClientRect()` returns
 * 0×0 for every element) and no canvas 2D context (`measureText` is unavailable). A
 * render-and-measure assertion in Vitest would pass against zeros — worse than no test,
 * because it would look like coverage. Verified against this repo's jsdom setup before
 * splitting the guard this way.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CUSTOM_NODE_TYPOGRAPHY } from "./typography";
import { measureLabelNode, type MeasurableNode } from "./measure";
import { approximateMeasureText } from "./measure-text";

const CUSTOM_NODE_SOURCE = resolve(process.cwd(), "src/features/canvas/nodes/CustomNode/index.tsx");

function customNodeSource(): string {
  return readFileSync(CUSTOM_NODE_SOURCE, "utf8");
}

/**
 * Each entry ties one typography constant to the Tailwind class that produces it.
 * `pattern` must appear in CustomNode's source for the constant to still be valid.
 */
const CSS_CONTRACT: Array<{
  what: string;
  pattern: RegExp;
  expected: number;
  actual: () => number;
}> = [
  {
    what: "shell min-width (min-w-[200px])",
    pattern: /min-w-\[200px\]/,
    expected: 200,
    actual: () => CUSTOM_NODE_TYPOGRAPHY.box.minWidth,
  },
  {
    what: "shell max-width (max-w-[260px])",
    pattern: /max-w-\[260px\]/,
    expected: 260,
    actual: () => CUSTOM_NODE_TYPOGRAPHY.box.maxWidth,
  },
  {
    what: "content padding-x (px-3 = 12px)",
    pattern: /px-3 py-2\.5/,
    expected: 12,
    actual: () => CUSTOM_NODE_TYPOGRAPHY.box.paddingX,
  },
  {
    what: "content padding-y (py-2.5 = 10px)",
    pattern: /px-3 py-2\.5/,
    expected: 10,
    actual: () => CUSTOM_NODE_TYPOGRAPHY.box.paddingY,
  },
  {
    what: "name font-size (text-sm = 14px)",
    pattern: /text-sm font-bold/,
    expected: 14,
    actual: () => CUSTOM_NODE_TYPOGRAPHY.name.fontSize,
  },
  {
    what: "name font-weight (font-bold = 700)",
    pattern: /text-sm font-bold/,
    expected: 700,
    actual: () => CUSTOM_NODE_TYPOGRAPHY.name.fontWeight,
  },
  {
    what: "name line cap (truncate = 1 line)",
    pattern: /leading-tight truncate/,
    expected: 1,
    actual: () => CUSTOM_NODE_TYPOGRAPHY.name.maxLines,
  },
  {
    what: "description font-size (text-xs = 12px)",
    pattern: /text-xs text-muted-foreground/,
    expected: 12,
    actual: () => CUSTOM_NODE_TYPOGRAPHY.description.fontSize,
  },
  {
    what: "description line cap (line-clamp-2 = 2 lines)",
    pattern: /line-clamp-2/,
    expected: 2,
    actual: () => CUSTOM_NODE_TYPOGRAPHY.description.maxLines,
  },
  {
    what: "technology font-size (text-[10px] = 10px)",
    pattern: /text-\[10px\] font-mono/,
    expected: 10,
    actual: () => CUSTOM_NODE_TYPOGRAPHY.technology.fontSize,
  },
  {
    what: "segment gap (mb-1.5 = 6px)",
    pattern: /mb-1\.5/,
    expected: 6,
    actual: () => CUSTOM_NODE_TYPOGRAPHY.box.segmentGap,
  },
  {
    what: "icon column (h-4 w-4 = 16px + gap-2 = 8px)",
    pattern: /h-4 w-4 shrink-0/,
    expected: 24,
    actual: () => CUSTOM_NODE_TYPOGRAPHY.box.iconWidth,
  },
];

describe("typography constants match the node CSS they mirror", () => {
  it.each(CSS_CONTRACT)("$what", ({ pattern, expected, actual }) => {
    // The class must still be in CustomNode…
    expect(customNodeSource()).toMatch(pattern);
    // …and the constant must still equal what that class produces.
    expect(actual()).toBe(expected);
  });

  it("keeps CustomNode as the renderer these constants describe", () => {
    const source = customNodeSource();
    // If the shell stops being a fixed-width card, the whole model needs revisiting.
    expect(source).toMatch(/min-w-\[\d+px\] max-w-\[\d+px\]/);
  });
});

/**
 * Representative nodes covering the node types the brief calls out. These are the same
 * fixtures the Cypress guard renders, so the two halves stay comparable.
 */
export const DIVERGENCE_FIXTURES: MeasurableNode[] = [
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

describe("measured fixtures stay inside what the CSS can render", () => {
  it.each(DIVERGENCE_FIXTURES)("$id fits the shell bounds", (node) => {
    const size = measureLabelNode(node, approximateMeasureText);
    const { box } = CUSTOM_NODE_TYPOGRAPHY;

    // A measurement outside the CSS bounds is by definition divergent: the browser
    // clamps to these, so the engine placing anything else guarantees a mismatch.
    expect(size.width).toBeGreaterThanOrEqual(box.minWidth);
    expect(size.width).toBeLessThanOrEqual(box.maxWidth);
    expect(size.height).toBeGreaterThanOrEqual(box.minHeight);
  });

  it("bounds total height by the maximum the segments can occupy", () => {
    const { name, description, technology, box } = CUSTOM_NODE_TYPOGRAPHY;
    const maxSegments =
      name.fontSize * name.lineHeight * name.maxLines +
      description.fontSize * description.lineHeight * description.maxLines +
      technology.fontSize * technology.lineHeight * technology.maxLines;
    const ceiling = Math.ceil(maxSegments + box.paddingY * 2 + box.segmentGap * 2);

    for (const node of DIVERGENCE_FIXTURES) {
      expect(measureLabelNode(node, approximateMeasureText).height).toBeLessThanOrEqual(ceiling);
    }
  });
});

describe("environment assumptions behind this split guard", () => {
  it("confirms jsdom cannot lay out — which is why part 2 runs in Cypress", () => {
    const el = document.createElement("div");
    el.style.width = "200px";
    el.style.height = "80px";
    el.textContent = "Payment Service";
    document.body.appendChild(el);

    const rect = el.getBoundingClientRect();
    document.body.removeChild(el);

    // If this ever becomes non-zero, jsdom gained layout and the Cypress half of the
    // guard could move here. Until then, a render-based assertion in Vitest is a lie.
    expect(rect.width).toBe(0);
    expect(rect.height).toBe(0);
  });

  it("confirms jsdom has no canvas 2D context, so measurement must be injected", () => {
    const ctx = document.createElement("canvas").getContext("2d");
    expect(ctx).toBeNull();
  });
});
