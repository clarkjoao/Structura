import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, win32 } from "node:path";
import { createRequire } from "node:module";
import { connectionKeys } from "./generated/opscr-mapping";
import {
  collectWorkspace,
  detectWorkspaceRoot,
  isManifestPath,
  PreviewPipeline,
  workspaceRoot,
  type WorkspaceText,
} from "./pipeline";
import { previewHtml } from "./webview-html";

/** How many compiles run at once, to see that updates do not overlap. */
const compiling = vi.hoisted(() => ({ now: 0, most: 0 }));
vi.mock("opscr/core", async (original) => {
  const core = await original<typeof import("opscr/core")>();
  return {
    ...core,
    compileSources: async (...args: Parameters<typeof core.compileSources>) => {
      compiling.most = Math.max(compiling.most, ++compiling.now);
      try {
        return await core.compileSources(...args);
      } finally {
        compiling.now -= 1;
      }
    },
  };
});

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

describe("a workspace in subfolders", () => {
  const EXAMPLE_DIR = join(dirname(require.resolve("opscr/package.json")), "examples/web-app-aws");
  const example = readdirSync(EXAMPLE_DIR).filter((n) => n.endsWith(".opscr.yaml"));
  /** Where each example file sits in the nested layout. */
  const nested = (name: string) =>
    /^shop-(context|containers|production)|^orders-api-components/.test(name)
      ? `views/${name}`
      : `model/${name}`;
  const NAMES_NESTED = example.map(nested);
  const readNested = async (path: string) => {
    const name = basename(path.replaceAll("\\", "/"));
    return readFileSync(join(EXAMPLE_DIR, name), "utf8");
  };

  it("reads manifests from subfolders, in a stable order, with paths under the folder", async () => {
    const workspace = await collectWorkspace("/w", [...NAMES_NESTED].reverse(), readNested);
    const paths = workspace.files.map((f) => f.path);
    expect(paths).toEqual([...paths].sort());
    expect(paths).toContain("/w/model/shop.opscr.yaml");
    expect(paths).toContain("/w/views/shop-context.opscr.yaml");
  });

  it("draws the whole workspace, not just the file's own folder", async () => {
    const workspace = await collectWorkspace("/w", NAMES_NESTED, readNested);
    const { graph, blocked, sources } = await new PreviewPipeline().update(workspace);
    expect(blocked).toBeUndefined();
    expect(graph!.components.map((c) => c.key)).toContain("Application/orders-api");
    expect(sources!.locate({ kind: "component", key: "Application/orders-api" })?.file).toBe(
      "/w/model/shop.opscr.yaml",
    );
  });

  it("skips node_modules and dot folders, and reads only the root's sidecars", async () => {
    const workspace = await collectWorkspace(
      "/w",
      [
        "a.opscr.yaml",
        "node_modules/pkg/x.opscr.yaml",
        ".git/y.opscr.yaml",
        "sub/.hidden/z.opscr.yaml",
        "sub/b.opscr.yaml",
        "sub/opscr.config.yaml",
        "sub/opscr.layout.json",
        "opscr.config.yaml",
      ],
      async (p) => `disk:${p}`,
    );
    expect(workspace.files.map((f) => f.path)).toEqual(["/w/a.opscr.yaml", "/w/sub/b.opscr.yaml"]);
    expect(workspace.config?.path).toBe("/w/opscr.config.yaml");
    expect(workspace.layout).toBeUndefined();
  });

  it("keeps backslash paths on Windows, with either separator in the names", async () => {
    const workspace = await collectWorkspace(
      "C:\\work\\shop",
      ["model/shop.opscr.yaml", "views\\shop-context.opscr.yaml"],
      readNested,
      win32.join,
    );
    expect(workspace.files.map((f) => f.path)).toEqual([
      "C:\\work\\shop\\model\\shop.opscr.yaml",
      "C:\\work\\shop\\views\\shop-context.opscr.yaml",
    ]);
  });
});

describe("workspaceRoot", () => {
  const configAt = (...folders: string[]) => async (folder: string) => folders.includes(folder);

  it("is the nearest folder above the file that has the config", async () => {
    expect(await workspaceRoot("/w/shop/views/a.opscr.yaml", configAt("/w/shop"))).toBe("/w/shop");
    expect(await workspaceRoot("/w/shop/a.opscr.yaml", configAt("/w/shop", "/w"))).toBe("/w/shop");
  });

  it("is the file's own folder when no config is found", async () => {
    expect(await workspaceRoot("/w/shop/views/a.opscr.yaml", configAt())).toBe("/w/shop/views");
  });

  it("does not look above the editor's workspace folder", async () => {
    expect(await workspaceRoot("/w/shop/a.opscr.yaml", configAt("/"), "/w")).toBe("/w/shop");
    expect(await workspaceRoot("/w/shop/views/a.opscr.yaml", configAt("/w"), "/w")).toBe("/w");
  });

  it("stops at the filesystem root", async () => {
    expect(await workspaceRoot("/a.opscr.yaml", configAt())).toBe("/");
  });
});

describe("detectWorkspaceRoot", () => {
  const EXAMPLE_DIR = join(dirname(require.resolve("opscr/package.json")), "examples/web-app-aws");
  const example = readdirSync(EXAMPLE_DIR).filter((n) => n.endsWith(".opscr.yaml"));
  const isView = (name: string) => /^shop-(context|containers|production)|^orders-api-components/.test(name);

  /** A disk of `path → text`; `list` answers like the extension's walker. */
  const disk = (files: Record<string, string>, tooBig: string[] = []) => ({
    hasConfig: async (folder: string) => `${folder}/opscr.config.yaml` in files,
    list: async (folder: string) =>
      tooBig.includes(folder)
        ? undefined
        : Object.keys(files)
            .filter((p) => p.startsWith(`${folder}/`))
            .map((p) => p.slice(folder.length + 1)),
    read: async (path: string) => files[path],
  });
  /** The web-app-aws example under `base`, model files in `model/` and views in `views/`. */
  const solution = (base: string) =>
    Object.fromEntries(
      example.map((n) => [
        `${base}/${isView(n) ? "views" : "model"}/${n}`,
        readFileSync(join(EXAMPLE_DIR, n), "utf8"),
      ]),
    );

  it("finds the solution's folder from a view that names elements in a sibling folder", async () => {
    const files = solution("/repo/docs/shop");
    const root = await detectWorkspaceRoot("/repo/docs/shop/views/shop-context.opscr.yaml", {
      ...disk(files),
      stopAt: "/repo",
    });
    expect(root).toBe("/repo/docs/shop");
  });

  it("does not take in a sibling solution, since the first folder that resolves wins", async () => {
    const files = { ...solution("/repo/docs/shop"), ...solution("/repo/docs/other") };
    const root = await detectWorkspaceRoot("/repo/docs/shop/views/shop-context.opscr.yaml", {
      ...disk(files),
      stopAt: "/repo",
    });
    expect(root).toBe("/repo/docs/shop");
  });

  it("stays on the file's own folder when it already holds everything it refers to", async () => {
    const files = solution("/repo/shop");
    const root = await detectWorkspaceRoot("/repo/shop/model/shop.opscr.yaml", {
      ...disk(files),
      stopAt: "/repo",
    });
    expect(root).toBe("/repo/shop/model");
  });

  it("uses a config above the file, without looking at references", async () => {
    const files = { ...solution("/repo/shop"), "/repo/shop/opscr.config.yaml": "packs: []\n" };
    const root = await detectWorkspaceRoot("/repo/shop/views/shop-context.opscr.yaml", {
      ...disk(files),
      stopAt: "/repo",
    });
    expect(root).toBe("/repo/shop");
  });

  it("does not climb past the editor's workspace folder", async () => {
    const files = solution("/repo/shop");
    const root = await detectWorkspaceRoot("/repo/shop/views/shop-context.opscr.yaml", {
      ...disk(files),
      stopAt: "/repo/shop/views",
    });
    expect(root).toBe("/repo/shop/views");
  });

  it("falls back to the folder with the fewest dangling references when none is clean", async () => {
    const files = solution("/repo/shop");
    const model = "/repo/shop/model/relationships.opscr.yaml";
    files[model] = files[model]!.replace("id: orders-api", "id: orders-apx");
    const root = await detectWorkspaceRoot("/repo/shop/views/shop-context.opscr.yaml", {
      ...disk(files),
      stopAt: "/repo",
    });
    // `shop/` has the one typo; `views/` alone has far more.
    expect(root).toBe("/repo/shop");
  });

  it("gives up climbing at a folder too big to be a workspace", async () => {
    const files = solution("/repo/shop");
    const root = await detectWorkspaceRoot("/repo/shop/views/shop-context.opscr.yaml", {
      ...disk(files, ["/repo/shop"]),
      stopAt: "/repo",
    });
    expect(root).toBe("/repo/shop/views");
  });
});

describe("on Windows", () => {
  it("keeps backslash paths, so the cursor's and the Problems panel's files match", async () => {
    const folder = "C:\\work\\shop";
    const workspace = await collectWorkspace(
      folder,
      NAMES,
      async (path) => readFileSync(join(SAMPLE_DIR, win32.basename(path)), "utf8"),
      win32.join,
    );
    const commerce = `${folder}\\commerce.opscr.yaml`;
    expect(workspace.files.map((f) => f.path)).toContain(commerce);
    const { graph, sources, diagnostics } = await new PreviewPipeline().update(workspace);
    expect(graph).toBeDefined();
    for (const d of diagnostics) if (d.file) expect(d.file.startsWith(`${folder}\\`)).toBe(true);
    const line =
      readFileSync(join(SAMPLE_DIR, basename(commerce.replaceAll("\\", "/"))), "utf8")
        .split("\n")
        .indexOf("  name: orders-api") + 1;
    expect(sources!.elementAt(commerce, line)).toEqual({
      kind: "component",
      key: "Application/orders-api",
    });
    expect(sources!.locate({ kind: "component", key: "Application/orders-api" })?.file).toBe(
      commerce,
    );
  });
});

describe("PreviewPipeline", () => {
  it("draws the multi-file sample: panels from one file, edges from another", async () => {
    const { graph, diagnostics } = await new PreviewPipeline().update(await sample());
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const keys = graph!.components.map((c) => c.key);
    expect(keys).toEqual(
      expect.arrayContaining(["Domain/commerce", "BoundedContext/orders", "Database/orders-db"]),
    );
    expect(graph!.connections).toContainEqual({
      source: "Application/orders-api",
      target: "Database/orders-db",
      label: "writes",
    });
  });

  it("knows where each element is written, and which element a line writes", async () => {
    const { graph, sources } = await new PreviewPipeline().update(await sample());
    const lineOf = (file: string, pattern: RegExp) =>
      readFileSync(join(SAMPLE_DIR, file), "utf8")
        .split("\n")
        .findIndex((line) => pattern.test(line)) + 1;
    const db = sources!.locate({ kind: "component", key: "Database/orders-db" })!;
    expect(db.file).toMatch(/commerce\.opscr\.yaml$/);
    expect(sources!.elementAt(db.file, db.line)).toEqual({
      kind: "component",
      key: "Database/orders-db",
    });
    // The writes edge: its connection key, located on its `- from:` line.
    const keys = connectionKeys(graph!.connections);
    const i = graph!.connections.findIndex(
      (c) => c.source === "Application/orders-api" && c.target === "Database/orders-db",
    );
    const edge = sources!.locate({ kind: "connection", key: keys[i]! })!;
    expect(edge.file).toMatch(/relationships\.opscr\.yaml$/);
    expect(edge.line).toBeGreaterThan(lineOf("relationships.opscr.yaml", /kind: Relationship/));
    expect(sources!.elementAt(edge.file, edge.line + 1)).toEqual({
      kind: "connection",
      key: keys[i],
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

  it("reports schema errors on their file and line, and does not draw until they are fixed", async () => {
    const result = await new PreviewPipeline().update(
      await edited("finance.opscr.yaml", (t) =>
        t.replace(/(\n\s+description:)/, "\n  inventedField: 1$1"),
      ),
    );
    const error = result.diagnostics.find((d) => d.message.includes("inventedField"));
    expect(error?.file).toMatch(/finance\.opscr\.yaml$/);
    expect(error?.line).toBeGreaterThan(0);
    expect(result.graph).toBeUndefined();
    expect(result.blocked).toMatchObject({ reason: "errors" });
  });

  it("runs overlapping updates one after another, each from the picture before it", async () => {
    compiling.most = 0;
    const pipeline = new PreviewPipeline();
    const [first, second] = await Promise.all([
      pipeline.update(await sample()),
      pipeline.update(await edited("relationships.opscr.yaml", (t) => t + CACHE)),
    ]);
    expect(compiling.most).toBe(1);
    const before = boxesOf(first.graph!);
    const after = boxesOf(second.graph!);
    for (const [key, at] of before) expect(after.get(key), key).toEqual(at);
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

describe("visual layer", () => {
  it("collects opscr.visual.json and draws an imported workspace's boundaries, services and text", async () => {
    const { importDrawio } = await import("opscr/import-drawio");
    const out = await importDrawio(
      readFileSync(
        "node_modules/opscr/tests/import/corpus/vendor/aws/example-microservices.drawio",
        "utf8",
      ),
      { source: "example-microservices.drawio" },
    );
    const names = out.map((f) => f.path);
    const workspace = await collectWorkspace(
      "/w",
      names,
      async (p) => out.find((f) => `/w/${f.path}` === p)?.content,
    );
    expect(workspace.visual).toBeDefined();
    const { graph } = await new PreviewPipeline().update(workspace);
    expect(graph!.components.find((c) => c.name === "AWS Cloud")).toMatchObject({ type: "panel" });
    expect(graph!.components.some((c) => c.cloudServiceId === "cloudwatch")).toBe(true);
    expect(
      graph!.components.some((c) => c.type === "text" && c.name === "Microservices on ECS Fargate"),
    ).toBe(true);
    expect(isManifestPath("/w/opscr.visual.json")).toBe(true);
  });
});
