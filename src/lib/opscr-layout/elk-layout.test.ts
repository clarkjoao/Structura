import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  buildTechnicalView,
  stabilizeLayout,
  toLayoutGraph,
  type OpscrWorkspaceInput,
} from "../opscr-mapping";
import { layoutView } from "./elk-layout";

const HERE = __dirname;
const sample = JSON.parse(
  readFileSync(`${HERE}/../opscr-mapping/__fixtures__/sample.workspace.json`, "utf8"),
) as OpscrWorkspaceInput;

/** The sample plus one Cache read by catalog-api — the edit the spike measured. */
const edited: OpscrWorkspaceInput = {
  manifests: [
    ...sample.manifests,
    { kind: "Cache", metadata: { name: "price-cache" }, spec: { provider: "ElastiCache Redis" } },
    {
      kind: "Relationship",
      metadata: { name: "extra" },
      spec: {
        edges: [
          {
            from: { kind: "Application", id: "catalog-api" },
            to: { kind: "Cache", id: "price-cache" },
            type: "reads",
          },
        ],
      },
    },
  ],
};

describe("opscr-layout is shareable", () => {
  it("imports only elkjs and the mapping", () => {
    for (const f of readdirSync(HERE).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      const imports = [
        ...readFileSync(`${HERE}/${f}`, "utf8").matchAll(/from\s+["']([^"']+)["']/g),
      ].map((m) => m[1]);
      for (const source of imports) {
        expect(
          source.startsWith("elkjs") || source === "../opscr-mapping" || source.startsWith("./"),
          `${f} imports ${source}`,
        ).toBe(true);
      }
    }
  });
});

describe("layoutView", () => {
  it("lays out the sample, every child inside its panel", async () => {
    const view = buildTechnicalView(sample);
    const { boxes } = await layoutView(toLayoutGraph(view));
    expect(boxes.size).toBe(view.nodes.length);
    for (const node of view.nodes.filter((n) => n.parentId)) {
      const child = boxes.get(node.id)!;
      const parent = boxes.get(node.parentId!)!;
      expect(child.x + child.width).toBeLessThanOrEqual(parent.width);
      expect(child.y + child.height).toBeLessThanOrEqual(parent.height);
    }
  });

  it("with stabilizeLayout, an added element moves nothing that was already drawn", async () => {
    const first = buildTechnicalView(sample);
    const previous = await layoutView(toLayoutGraph(first));
    const second = buildTechnicalView(edited);
    const fresh = await layoutView(toLayoutGraph(second), previous.boxes);
    const { boxes } = stabilizeLayout(second, fresh, previous);

    for (const node of first.nodes) {
      const before = previous.boxes.get(node.id)!;
      expect(boxes.get(node.id), node.id).toMatchObject({ x: before.x, y: before.y });
    }
    const cache = boxes.get("Cache/price-cache")!;
    for (const node of second.nodes.filter(
      (n) => n.parentId === null && n.id !== "Cache/price-cache",
    )) {
      const other = boxes.get(node.id)!;
      const overlap =
        cache.x < other.x + other.width &&
        other.x < cache.x + cache.width &&
        cache.y < other.y + other.height &&
        other.y < cache.y + cache.height;
      expect(overlap, `price-cache overlaps ${node.id}`).toBe(false);
    }
  });
});
