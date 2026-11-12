import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A node that blurs what is behind it (`backdrop-blur`) makes the compositor
 * re-layerize the canvas on every frame that paints: at far zoom on 1000
 * nodes, 40 panels cost 1.7-2.9 s of Layerize in 30 wheel ticks. The stylesheet
 * switches the blur off at far zoom for every element marked
 * `data-canvas-blur` — so a node renderer that blurs must mark the element,
 * and the stylesheet must keep the rule.
 */

const NODES = __dirname;
const CSS = fs
  .readFileSync(path.resolve(NODES, "../../../index.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [full];
  });
}

/** The declarations of the first rule whose selector list contains `selector`. */
function ruleBody(selector: string): string | null {
  for (const match of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(",").map((s) => s.trim());
    if (selectors.includes(selector)) return match[2];
  }
  return null;
}

describe("node backdrop blur", () => {
  it("is marked data-canvas-blur by every node renderer that blurs", () => {
    const blurring = sources(NODES).filter((file) =>
      /\bbackdrop-blur/.test(fs.readFileSync(file, "utf8")),
    );
    expect(blurring.length).toBeGreaterThan(0);
    const unmarked = blurring
      .filter((file) => !fs.readFileSync(file, "utf8").includes("data-canvas-blur"))
      .map((file) => path.relative(NODES, file));
    expect(unmarked).toEqual([]);
  });

  it.each([['.react-flow[data-lod="far"] [data-canvas-blur]']])(
    "is switched off by %s",
    (selector) => {
      const body = ruleBody(selector);
      expect(body).not.toBeNull();
      expect(body).toMatch(/(^|[;\s])backdrop-filter:\s*none/);
      expect(body).toMatch(/-webkit-backdrop-filter:\s*none/);
    },
  );
});
