import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { collectWorkspace, PreviewPipeline, type WorkspaceText } from "./pipeline";
import { previewHtml } from "./webview-html";

const require = createRequire(import.meta.url);
const SAMPLE_DIR = join(dirname(require.resolve("opscr/package.json")), "examples/sample");
// Manifests and config only: a layout sidecar left in the sample by a manual test would seed the
// layout; the sidecar has its own tests below.
const NAMES = readdirSync(SAMPLE_DIR).filter((name) => name !== "opscr.layout.json");
const fromDisk = async (path: string) => readFileSync(path, "utf8");

const CACHE = `
---
apiVersion: opscr.dev/v1
kind: Cache
metadata: { name: price-cache }
spec: { provider: ElastiCache Redis, description: Prices }
---
apiVersion: opscr.dev/v1
kind: Relationship
metadata: { name: extra }
spec:
  edges:
    - from: { kind: Application, id: catalog-api }
      to: { kind: Cache, id: price-cache }
      type: reads
`;

const sample = () => collectWorkspace(SAMPLE_DIR, NAMES, fromDisk);
/** The sample with `edit` applied to the text of one of its files. */
const edited = (file: string, edit: (text: string) => string) =>
  collectWorkspace(SAMPLE_DIR, NAMES, async (path) =>
    path.endsWith(`/${file}`) ? edit(readFileSync(path, "utf8")) : readFileSync(path, "utf8"),
  );
const boxesOf = (graph: { components: Array<{ key: string; x: number; y: number }> }) =>
  new Map(graph.components.map((c) => [c.key, [c.x, c.y]]));

describe("collectWorkspace", () => {
  it("reads every manifest of the folder and its config, through the given reader", async () => {
    const workspace = await collectWorkspace(
      "/w",
      ["b.opscr.yaml", "a.opscr.yml", "notes.md", "opscr.config.yaml"],
      async (p) => (p.endsWith("a.opscr.yml") ? "unsaved" : `disk:${p}`),
    );
    expect(workspace.files).toEqual([
      { path: "/w/a.opscr.yml", content: "unsaved" },
      { path: "/w/b.opscr.yaml", content: "disk:/w/b.opscr.yaml" },
    ]);
    expect(workspace.config).toEqual({
      path: "/w/opscr.config.yaml",
      content: "disk:/w/opscr.config.yaml",
    });
  });
});

describe("PreviewPipeline", () => {
  it("draws the multi-file sample: panels from one file, edges from another", async () => {
    const { graph, diagnostics } = await new PreviewPipeline().update(await sample());
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const keys = graph!.components.map((c) => c.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Domain/commerce",
        "ApplicationService/orders",
        "Database/orders-db",
      ]),
    );
    expect(graph!.connections).toContainEqual({
      source: "Application/orders-api",
      target: "Database/orders-db",
      label: "writes",
    });
  });

  it("keeps every element in place when one is added", async () => {
    const pipeline = new PreviewPipeline();
    const before = boxesOf((await pipeline.update(await sample())).graph!);
    const after = boxesOf(
      (await pipeline.update(await edited("relationships.opscr.yaml", (t) => t + CACHE))).graph!,
    );
    for (const [key, at] of before) expect(after.get(key), key).toEqual(at);
    expect(after.has("Cache/price-cache")).toBe(true);
  });

  it("moves nothing when only a description changes", async () => {
    const pipeline = new PreviewPipeline();
    const before = boxesOf((await pipeline.update(await sample())).graph!);
    const after = boxesOf(
      (
        await pipeline.update(
          await edited("commerce.opscr.yaml", (t) =>
            t.replace(/description: "[^"]*"/, 'description: "x"'),
          ),
        )
      ).graph!,
    );
    expect(after).toEqual(before);
  });

  it("posts nothing while the YAML does not parse, and reports why", async () => {
    const pipeline = new PreviewPipeline();
    await pipeline.update(await sample());
    const broken: WorkspaceText = await edited("shared.opscr.yaml", (t) => t + "\nkind: [");
    const result = await pipeline.update(broken);
    expect(result.graph).toBeUndefined();
    expect(result.diagnostics.map((d) => d.ruleId)).toContain("loader/yaml-parse-error");
  });

  it("reports schema errors on their file and line, and still draws", async () => {
    const result = await new PreviewPipeline().update(
      await edited("finance.opscr.yaml", (t) =>
        t.replace(/(\n\s+description:)/, "\n  inventedField: 1$1"),
      ),
    );
    const error = result.diagnostics.find((d) => d.message.includes("inventedField"));
    expect(error?.file).toMatch(/finance\.opscr\.yaml$/);
    expect(error?.line).toBeGreaterThan(0);
    expect(result.graph).toBeDefined();
  });

  it("lays everything out again after relayout()", async () => {
    const pipeline = new PreviewPipeline();
    const first = boxesOf((await pipeline.update(await sample())).graph!);
    pipeline.relayout();
    const again = boxesOf((await pipeline.update(await sample())).graph!);
    expect(again).toEqual(first); // same input, from scratch: the same deterministic layout
  });
});

describe("layout sidecar", () => {
  const withSidecar = async (layout: string) => ({ ...(await sample()), layout });
  const sidecarOf = (boxes: Record<string, { x: number; y: number }>) =>
    JSON.stringify({
      version: 1,
      elements: Object.fromEntries(
        Object.entries(boxes).map(([k, b]) => [k, { ...b, width: 180, height: 80 }]),
      ),
    });

  it("collects the folder's sidecar", async () => {
    const workspace = await collectWorkspace(
      "/w",
      ["a.opscr.yaml", "opscr.layout.json"],
      async (p) => p,
    );
    expect(workspace.layout).toBe("/w/opscr.layout.json");
  });

  it("draws elements at their sidecar box, others by the stable layout", async () => {
    const { graph } = await new PreviewPipeline().update(
      await withSidecar(sidecarOf({ "Database/orders-db": { x: 900, y: 300 } })),
    );
    const db = graph!.components.find((c) => c.key === "Database/orders-db")!;
    expect([db.x, db.y]).toEqual([900, 300]);
  });

  it("re-applies a changed sidecar, and ignores an unchanged one after relayout()", async () => {
    const pipeline = new PreviewPipeline();
    const first = await withSidecar(sidecarOf({ "Database/orders-db": { x: 900, y: 300 } }));
    await pipeline.update(first);
    const moved = await pipeline.update(
      await withSidecar(sidecarOf({ "Database/orders-db": { x: 50, y: 700 } })),
    );
    const at = (g: typeof moved) => {
      const db = g.graph!.components.find((c) => c.key === "Database/orders-db")!;
      return [db.x, db.y];
    };
    expect(at(moved)).toEqual([50, 700]);
    pipeline.relayout();
    const fresh = await pipeline.update(
      await withSidecar(sidecarOf({ "Database/orders-db": { x: 50, y: 700 } })),
    );
    expect(at(fresh)).not.toEqual([50, 700]);
  });
});

describe("previewHtml", () => {
  it("adds a CSP and a base to the embed page", () => {
    const html = previewHtml(
      "<html><head><title>x</title></head></html>",
      "vscode-webview://x/media/embed",
      "vscode-src",
    );
    expect(html).toContain('<base href="vscode-webview://x/media/embed/">');
    expect(html).toContain("script-src vscode-src");
    expect(html).not.toContain("unsafe-eval");
  });
});
