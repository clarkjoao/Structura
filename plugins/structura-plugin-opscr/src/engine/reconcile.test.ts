import { SAMPLE_FILES } from "../test-sample";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { countEdges, hasManifest, renameElement, type SourceText } from "./patches";
import { projectWorkspace } from "../project";
import { reconcile, renameInBinding } from "./reconcile";
import { addElementsToYaml, slugName } from "./adopt";
import { emptyBinding, sidecarText, type BindingState } from "./sync";
import { OpscrEngine, type EngineOptions } from "./engine";
import { LAYOUT_FILE } from "../generated/opscr-mapping";
import { FakeCanvas } from "./fake-canvas.fixture";
import type { PluginComponentSnapshot, PluginDiagramChanges } from "../types/plugin.types";

const SAMPLE: SourceText[] = Object.keys(SAMPLE_FILES)
  .filter((f) => f.endsWith(".opscr.yaml"))
  .sort()
  .map((name) => ({ name, text: SAMPLE_FILES[name]! }));
const CONFIG = {
  path: "opscr.config.yaml",
  content: SAMPLE_FILES["opscr.config.yaml"]!,
};

/** The pane's loop without React: reconcile, then sync, with tombstones for sync removals. */
/** The binding engine over the fake canvas, the sample files and an in-memory binding. */
class Session {
  canvas = new FakeCanvas();
  binding: BindingState = emptyBinding();
  files: SourceText[] = structuredClone(SAMPLE);
  refused: string[] = [];
  sidecar = "";
  /** Every change set the engine applied during the last pump. */
  applied: PluginDiagramChanges[] = [];
  engineOptions = (): EngineOptions => ({
    texts: {
      get: () => [...this.files, { name: LAYOUT_FILE, text: this.sidecar }],
      set: (files) => {
        for (const file of files) {
          if (file.name === LAYOUT_FILE) this.sidecar = file.text;
          else if (this.files.some((f) => f.name === file.name)) {
            this.files = this.files.map((f) => (f.name === file.name ? { ...file } : f));
          } else this.files = [...this.files, { ...file }];
        }
      },
    },
    diagram: {
      get: () => this.canvas.snapshot(),
      apply: (changes) => {
        this.applied.push(changes);
        return this.canvas.apply(changes);
      },
    },
    binding: { get: () => this.binding, set: (state) => void (this.binding = state) },
    project: (manifests, _config, previous) =>
      projectWorkspace(
        manifests.map((f) => ({ path: f.name, content: f.text })),
        CONFIG,
        previous,
      ),
    isManifest: (name) => name.endsWith(".opscr.yaml"),
    configFile: CONFIG.path,
    onEvent: (event) => {
      if (event.type === "rename-refused") this.refused.push(event.name);
    },
  });
  engine = new OpscrEngine(this.engineOptions());

  /** One engine sync (reconcile, then YAML → canvas); returns what it changed on the canvas. */
  async pump() {
    this.applied = [];
    this.refused = [];
    await this.engine.sync();
    const all = <T>(pick: (c: PluginDiagramChanges) => T[] | undefined): T[] =>
      this.applied.flatMap((c) => pick(c) ?? []);
    return {
      empty: this.applied.length === 0,
      changes: {
        add: all((c) => c.add),
        remove: all((c) => c.remove),
        connect: all((c) => c.connect),
        disconnect: all((c) => c.disconnect),
      },
    };
  }

  id(name: string) {
    return this.canvas.components.find((c) => c.label === name)!.id;
  }

  text() {
    return this.files.map((f) => f.text).join("\n---\n");
  }

  /** After a pump, a second one must change nothing on either side. */
  async expectSettled() {
    const before = this.files.map((f) => f.text);
    const plan = await this.pump();
    expect(plan.empty).toBe(true);
    expect(this.files.map((f) => f.text)).toEqual(before);
  }
}

let s: Session;
beforeEach(async () => {
  s = new Session();
  await s.pump();
});

describe("reconcile", () => {
  it("does nothing when the canvas matches the binding", async () => {
    await s.expectSettled();
    expect(s.text()).toBe(SAMPLE.map((f) => f.text).join("\n---\n"));
  });

  it("a canvas rename renames the manifest and its edge ends, and keeps the element", async () => {
    const id = s.id("orders-db");
    const position = s.canvas.components.find((c) => c.id === id)!.position;
    s.canvas.step(() => (s.canvas.components.find((c) => c.id === id)!.label = "order-store"));
    await s.pump();
    expect(s.text()).not.toContain("orders-db");
    expect(hasManifest(s.files, { kind: "Database", name: "order-store" })).toBe(true);
    expect(s.canvas.components.find((c) => c.label === "order-store")?.id).toBe(id);
    expect(s.canvas.components.find((c) => c.id === id)!.position).toEqual(position);
    await s.expectSettled();
  });

  it("renaming a panel keeps its children", async () => {
    const children = s.canvas.components
      .filter((c) => c.parentId === s.id("orders"))
      .map((c) => c.id);
    expect(children.length).toBeGreaterThan(0);
    s.canvas.step(
      () => (s.canvas.components.find((c) => c.label === "orders")!.label = "ordering-app"),
    );
    await s.pump();
    for (const child of children)
      expect(s.canvas.components.some((c) => c.id === child)).toBe(true);
    await s.expectSettled();
  });

  it("refuses a name the Kind already uses and puts the canvas name back", async () => {
    s.canvas.step(
      () => (s.canvas.components.find((c) => c.label === "orders-db")!.label = "catalog-db"),
    );
    await s.pump();
    expect(s.refused).toEqual(["catalog-db"]);
    expect(s.canvas.components.filter((c) => c.label === "orders-db")).toHaveLength(1);
    expect(s.text()).toBe(SAMPLE.map((f) => f.text).join("\n---\n"));
    await s.expectSettled();
  });

  it("a canvas description edit sets spec.description", async () => {
    s.canvas.step(
      () => (s.canvas.components.find((c) => c.label === "orders-db")!.description = "Orders"),
    );
    await s.pump();
    expect(s.text()).toContain('description: "Orders"');
    await s.expectSettled();
  });

  it("a canvas delete removes the manifest and its edges; undo and redo follow", async () => {
    const id = s.id("cart-cache");
    const count = s.canvas.components.length;
    s.canvas.step(() => s.canvas.remove([id]));
    await s.pump();
    expect(s.text()).not.toContain("cart-cache");
    expect(s.canvas.components).toHaveLength(count - 1);
    await s.expectSettled();

    s.canvas.undo();
    await s.pump();
    expect(hasManifest(s.files, { kind: "Cache", name: "cart-cache" })).toBe(true);
    expect(s.canvas.components.find((c) => c.label === "cart-cache")?.id).toBe(id);
    expect(s.canvas.components).toHaveLength(count);
    await s.expectSettled();
    const edges = s.canvas.connections.filter((c) => c.sourceId === id || c.targetId === id);
    expect(edges.length).toBeGreaterThan(0);

    s.canvas.redo();
    await s.pump();
    expect(s.text()).not.toContain("cart-cache");
    await s.expectSettled();
  });

  it("deleting a panel removes everything drawn inside it", async () => {
    const inside = s.canvas.components
      .filter((c) => c.parentId === s.id("catalog"))
      .map((c) => c.label);
    s.canvas.step(() => s.canvas.remove([s.id("catalog")]));
    await s.pump();
    for (const name of inside) expect(s.text()).not.toMatch(new RegExp(`name: ${name}\\n`));
    await s.expectSettled();
  });

  it("a drawn connection becomes an edge; a relabel retypes it; a delete removes it", async () => {
    const from = { kind: "Application", name: "order-tracker" };
    const to = { kind: "Database", name: "catalog-db" };
    let id = "";
    s.canvas.step(() => (id = s.canvas.connect(s.id("order-tracker"), s.id("catalog-db"), "")));
    await s.pump();
    expect(countEdges(s.files, { from, to, type: "calls" })).toBe(1);
    await s.expectSettled();
    expect(s.canvas.connections.filter((c) => c.id === id)).toHaveLength(1);

    s.canvas.step(() => (s.canvas.connections.find((c) => c.id === id)!.label = "reads"));
    await s.pump();
    expect(countEdges(s.files, { from, to, type: "reads" })).toBe(1);
    expect(countEdges(s.files, { from, to, type: "calls" })).toBe(0);
    await s.expectSettled();

    s.canvas.step(() => (s.canvas.connections = s.canvas.connections.filter((c) => c.id !== id)));
    await s.pump();
    expect(countEdges(s.files, { from, to, type: "reads" })).toBe(0);
    await s.expectSettled();
  });

  it("deletes two equal connections at once", async () => {
    const from = { kind: "Application", name: "order-tracker" };
    const to = { kind: "Database", name: "catalog-db" };
    const ids: string[] = [];
    s.canvas.step(() => {
      ids.push(s.canvas.connect(s.id("order-tracker"), s.id("catalog-db"), ""));
      ids.push(s.canvas.connect(s.id("order-tracker"), s.id("catalog-db"), ""));
    });
    await s.pump();
    expect(countEdges(s.files, { from, to, type: "calls" })).toBe(2);
    await s.expectSettled();

    s.canvas.step(
      () => (s.canvas.connections = s.canvas.connections.filter((c) => !ids.includes(c.id))),
    );
    await s.pump();
    expect(countEdges(s.files, { from, to, type: "calls" })).toBe(0);
    expect(
      s.canvas.connections.filter(
        (c) => c.sourceId === s.id("order-tracker") && c.targetId === s.id("catalog-db"),
      ),
    ).toHaveLength(0);
    await s.expectSettled();
  });

  it("relabels two equal connections at once", async () => {
    const from = { kind: "Application", name: "order-tracker" };
    const to = { kind: "Database", name: "catalog-db" };
    const ids: string[] = [];
    s.canvas.step(() => {
      ids.push(s.canvas.connect(s.id("order-tracker"), s.id("catalog-db"), ""));
      ids.push(s.canvas.connect(s.id("order-tracker"), s.id("catalog-db"), ""));
    });
    await s.pump();
    s.canvas.step(() => {
      for (const c of s.canvas.connections) if (ids.includes(c.id)) c.label = "reads";
    });
    await s.pump();
    expect(countEdges(s.files, { from, to, type: "reads" })).toBe(2);
    expect(countEdges(s.files, { from, to, type: "calls" })).toBe(0);
    await s.expectSettled();
  });

  it("a retyped edge is keyed by its place among the edges of its new type", async () => {
    let first = "";
    let second = "";
    s.canvas.step(() => (first = s.canvas.connect(s.id("order-tracker"), s.id("catalog-db"), "")));
    await s.pump();
    s.canvas.step(
      () => (second = s.canvas.connect(s.id("order-tracker"), s.id("catalog-db"), "reads")),
    );
    await s.pump();
    s.canvas.step(() => (s.canvas.connections.find((c) => c.id === first)!.label = "reads"));
    await s.pump();
    const base = "Application/order-tracker->Database/catalog-db:reads";
    // The first edge comes first in the text.
    expect(s.binding.connections[`${base}#0`]).toBe(first);
    expect(s.binding.connections[`${base}#1`]).toBe(second);
    await s.expectSettled();
  });

  it("undoing a sync that added an element removes it from the text, redo puts it back", async () => {
    s.files = s.files.map((f) =>
      f.name === "commerce.opscr.yaml"
        ? {
            ...f,
            text: `${f.text}\n---\napiVersion: opscr.dev/v1\nkind: Storage\nmetadata:\n  name: exports\nspec:\n  provider: S3\n  description: Exports\n`,
          }
        : f,
    );
    await s.pump();
    expect(s.canvas.components.some((c) => c.label === "exports")).toBe(true);
    s.canvas.undo();
    await s.pump();
    expect(s.text()).not.toContain("name: exports");
    await s.expectSettled();
    s.canvas.redo();
    await s.pump();
    expect(hasManifest(s.files, { kind: "Storage", name: "exports" })).toBe(true);
    await s.expectSettled();
  });

  it("undoing a sync that removed an element brings its text back", async () => {
    const before = s.text();
    s.files = s.files.map((f) =>
      f.name === "commerce.opscr.yaml"
        ? {
            ...f,
            text: f.text.replace(
              /---\napiVersion: opscr.dev\/v1\nkind: Cache\n[\s\S]*?(?=---)/,
              "",
            ),
          }
        : f,
    );
    expect(hasManifest(s.files, { kind: "Cache", name: "cart-cache" })).toBe(false);
    await s.pump();
    expect(s.canvas.components.some((c) => c.label === "cart-cache")).toBe(false);
    s.canvas.undo();
    await s.pump();
    expect(hasManifest(s.files, { kind: "Cache", name: "cart-cache" })).toBe(true);
    expect(s.canvas.components.some((c) => c.label === "cart-cache")).toBe(true);
    expect(s.text()).not.toBe(before); // moved to the end of its file, same content
    await s.expectSettled();
  });

  it("leaves palette elements alone and counts them", () => {
    s.canvas.step(() =>
      s.canvas.components.push({
        id: "x",
        type: "container",
        label: "Free",
        description: "",
        parentId: null,
        position: { x: 0, y: 0 },
        size: null,
        tags: [],
        serviceId: null,
        cloudServiceId: null,
        technology: null,
      }),
    );
    const r = reconcile(s.canvas.snapshot(), s.binding, s.files);
    expect(r.changed).toBe(false);
    expect(r.notInYaml).toBe(1);
  });

  it("reports connections the YAML does not carry as drawn", async () => {
    const from = { kind: "Application", name: "order-tracker" };
    const to = { kind: "Database", name: "catalog-db" };
    let http = "";
    let loose = "";
    s.canvas.step(() => {
      s.canvas.components.push({
        id: "x",
        type: "container",
        label: "Free",
        description: "",
        parentId: null,
        position: { x: 0, y: 0 },
        size: null,
        tags: [],
        serviceId: null,
        cloudServiceId: null,
        technology: null,
      });
      http = s.canvas.connect(s.id("order-tracker"), s.id("catalog-db"), "HTTP");
      loose = s.canvas.connect(s.id("order-tracker"), "x", "calls");
    });
    const r = reconcile(s.canvas.snapshot(), s.binding, s.files);
    // A label that is not an edge type is written as the default type, and said so.
    expect(countEdges(r.files, { from, to, type: "calls" })).toBe(1);
    expect(r.unwritten).toEqual(
      expect.arrayContaining([
        { id: http, reason: "not-a-type", label: "HTTP", type: "calls" },
        { id: loose, reason: "end-outside", label: "calls" },
      ]),
    );
    expect(r.unwritten).toHaveLength(2);
  });

  it("reports a relabel the edge type cannot follow, and nothing once it can", async () => {
    let id = "";
    s.canvas.step(() => (id = s.canvas.connect(s.id("order-tracker"), s.id("catalog-db"), "")));
    await s.pump();
    s.canvas.step(() => (s.canvas.connections.find((c) => c.id === id)!.label = "maybe"));
    expect(reconcile(s.canvas.snapshot(), s.binding, s.files).unwritten).toEqual([
      { id, reason: "not-a-type", label: "maybe", type: "calls" },
    ]);
    s.canvas.step(() => (s.canvas.connections.find((c) => c.id === id)!.label = "reads"));
    expect(reconcile(s.canvas.snapshot(), s.binding, s.files).unwritten).toEqual([]);
  });

  it("skips while a file does not parse", () => {
    const broken = s.files.map((f, i) => (i === 0 ? { ...f, text: `${f.text}\n  bad: [\n` } : f));
    s.canvas.step(() => s.canvas.remove([s.id("cart-cache")]));
    const r = reconcile(s.canvas.snapshot(), s.binding, broken);
    expect(r.skipped).toBe(true);
    expect(r.files).toEqual(broken);
  });
});

describe("layout sidecar", () => {
  const box = (session: Session, name: string) => {
    const c = session.canvas.components.find((x) => x.label === name)!;
    return { ...c.position!, parentId: c.parentId };
  };

  it("a fresh diagram bound to the folder takes the sidecar's arrangement", async () => {
    s.canvas.step(
      () =>
        (s.canvas.components.find((c) => c.label === "orders-db")!.position = { x: 900, y: 300 }),
    );
    s.sidecar = sidecarText(s.binding, s.canvas.snapshot());
    expect(s.sidecar).toContain('"Database/orders-db": { "x": 900, "y": 300');

    const fresh = new Session();
    fresh.sidecar = s.sidecar;
    await fresh.pump();
    expect(box(fresh, "orders-db")).toMatchObject({ x: 900, y: 300 });
    // The sidecar keeps whole numbers.
    for (const name of ["public-api", "orders-api", "commerce"]) {
      expect(Math.abs(box(fresh, name).x - box(s, name).x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(box(fresh, name).y - box(s, name).y)).toBeLessThanOrEqual(0.5);
    }
  });

  it("follows a canvas rename and delete", async () => {
    s.canvas.step(
      () => (s.canvas.components.find((c) => c.label === "orders-db")!.label = "order-store"),
    );
    s.canvas.step(() => s.canvas.remove([s.id("cart-cache")]));
    await s.pump();
    expect(s.sidecar).toContain('"Database/order-store"');
    expect(s.sidecar).not.toContain("orders-db");
    expect(s.sidecar).not.toContain("cart-cache");
  });
});

describe("F2 rename (from the text)", () => {
  it("renames everywhere and keeps the canvas element, children included", async () => {
    const id = s.id("orders");
    const children = s.canvas.components.filter((c) => c.parentId === id).map((c) => c.id);
    s.files = renameElement(
      s.files,
      { kind: "ApplicationService", name: "orders" },
      "ordering-app",
    )!;
    s.binding = renameInBinding(
      s.binding,
      "ApplicationService/orders",
      "ApplicationService/ordering-app",
    );
    s.canvas.apply({ update: [{ id, name: "ordering-app" }] });
    const plan = await s.pump();
    expect(plan.changes.remove).toEqual([]);
    expect(plan.changes.add).toEqual([]);
    expect(s.canvas.components.find((c) => c.id === id)?.label).toBe("ordering-app");
    for (const child of children)
      expect(s.canvas.components.find((c) => c.id === child)?.parentId).toBe(id);
    await s.expectSettled();
  });
});

describe("binding again", () => {
  it("adopts what the canvas already shows instead of drawing duplicates", async () => {
    const components = s.canvas.components.map((c) => c.id).sort();
    const connections = s.canvas.connections.map((c) => c.id).sort();
    s.canvas.step(
      () => (s.canvas.components.find((c) => c.label === "orders-db")!.position = { x: 5, y: 5 }),
    );
    s.binding = emptyBinding(); // unbind, then bind the same folder again
    const plan = await s.pump();
    expect(plan.changes.add).toEqual([]);
    expect(plan.changes.connect).toEqual([]);
    expect(plan.changes.remove).toEqual([]);
    expect(s.canvas.components.map((c) => c.id).sort()).toEqual(components);
    expect(s.canvas.connections.map((c) => c.id).sort()).toEqual(connections);
    expect(s.canvas.components.find((c) => c.label === "orders-db")!.position).toEqual({
      x: 5,
      y: 5,
    });
    await s.expectSettled();
  });

  it("adds what the canvas lacks, nested in an adopted panel", async () => {
    s.canvas.step(() => s.canvas.remove([s.id("orders-api")]));
    s.binding = emptyBinding();
    const plan = await s.pump();
    expect(plan.changes.add?.map((c) => c.name)).toEqual(["orders-api"]);
    expect(s.canvas.components.find((c) => c.label === "orders-api")?.parentId).toBe(
      s.id("orders"),
    );
    await s.expectSettled();
  });
});

describe("palette elements into the YAML", () => {
  const draw = (over: Partial<PluginComponentSnapshot>) => {
    const component: PluginComponentSnapshot = {
      id: "p1",
      type: "aws-database",
      label: "Price Store",
      description: "Prices",
      parentId: s.id("orders"),
      position: { x: 20, y: 300 },
      size: null,
      tags: [],
      serviceId: null,
      cloudServiceId: "dynamodb",
      technology: "DynamoDB",
      ...over,
    };
    s.canvas.step(() => s.canvas.components.push(component));
    return component;
  };

  it("are counted as outside the YAML until added", () => {
    draw({});
    const r = reconcile(s.canvas.snapshot(), s.binding, s.files);
    expect(r.outside).toEqual(["p1"]);
  });

  it("an added element gets a manifest, its belongsTo and its connections, and keeps its id", async () => {
    draw({});
    let connection = "";
    s.canvas.step(() => (connection = s.canvas.connect(s.id("orders-api"), "p1", "")));
    const result = addElementsToYaml(s.files, s.binding, s.canvas.snapshot(), [
      { id: "p1", kind: "Database", provider: "DynamoDB" },
    ]);
    expect(result.added).toEqual(["Database/price-store"]);
    s.files = result.files;
    s.binding = result.binding;
    const plan = await s.pump();
    expect(plan.changes.add).toEqual([]);
    expect(plan.changes.remove).toEqual([]);
    const ref = { kind: "Database", name: "price-store" };
    expect(hasManifest(s.files, ref)).toBe(true);
    expect(
      countEdges(s.files, {
        from: ref,
        to: { kind: "ApplicationService", name: "orders" },
        type: "belongsTo",
      }),
    ).toBe(1);
    expect(
      countEdges(s.files, {
        from: { kind: "Application", name: "orders-api" },
        to: ref,
        type: "calls",
      }),
    ).toBe(1);
    expect(s.canvas.components.find((c) => c.id === "p1")?.label).toBe("price-store");
    expect(s.canvas.connections.some((c) => c.id === connection)).toBe(true);
    await s.expectSettled();
  });

  it("an element whose Kind draws another shape is redrawn in its place", async () => {
    draw({
      type: "container",
      cloudServiceId: null,
      technology: null,
      parentId: null,
      label: "Search",
    });
    const result = addElementsToYaml(s.files, s.binding, s.canvas.snapshot(), [
      { id: "p1", kind: "Cache", provider: "ElastiCache Redis" },
    ]);
    s.files = result.files;
    s.binding = result.binding;
    const plan = await s.pump();
    expect(plan.changes.remove).toEqual(["p1"]);
    expect(plan.changes.add?.map((c) => [c.name, c.type])).toEqual([["search", "aws-database"]]);
    await s.expectSettled();
  });

  it("names elements in kebab-case", () => {
    expect(slugName("Price Store (v2)")).toBe("price-store-v2");
    expect(slugName("Pagamentos Ação")).toBe("pagamentos-acao");
    expect(slugName("!!!")).toBe("element");
  });
});

describe("moving an element into another panel", () => {
  const tracker = { kind: "Application", name: "order-tracker" };
  const belongsTo = (parent: string) =>
    countEdges(s.files, {
      from: tracker,
      to: { kind: "ApplicationService", name: parent },
      type: "belongsTo",
    });
  const move = (parentId: string | null) =>
    s.canvas.step(
      () => (s.canvas.components.find((c) => c.label === "order-tracker")!.parentId = parentId),
    );

  it("retargets its belongsTo and keeps the element", async () => {
    const id = s.id("order-tracker");
    expect(belongsTo("orders")).toBe(1);
    move(s.id("catalog"));
    const plan = await s.pump();
    expect(belongsTo("orders")).toBe(0);
    expect(belongsTo("catalog")).toBe(1);
    expect(plan.changes.remove).toEqual([]);
    expect(s.canvas.components.find((c) => c.label === "order-tracker")?.id).toBe(id);
    await s.expectSettled();

    // Undo past the sync's own step (the panel that grew) back to the move.
    const ordersId = s.id("orders");
    while (s.canvas.components.find((c) => c.id === id)?.parentId !== ordersId) s.canvas.undo();
    await s.pump();
    expect(belongsTo("orders")).toBe(1);
    expect(belongsTo("catalog")).toBe(0);
    await s.expectSettled();
  });

  it("moved to the top level, loses its belongsTo", async () => {
    move(null);
    await s.pump();
    expect(belongsTo("orders")).toBe(0);
    await s.expectSettled();
  });

  it("taken out of its panel and then into another, gets that one's belongsTo", async () => {
    move(null);
    await s.pump();
    move(s.id("catalog"));
    await s.pump();
    expect(belongsTo("orders")).toBe(0);
    expect(belongsTo("catalog")).toBe(1);
    await s.expectSettled();
  });

  it("waits while the target panel is outside the YAML", async () => {
    s.canvas.step(() =>
      s.canvas.components.push({
        id: "free-panel",
        type: "panel",
        label: "Draft",
        description: "",
        parentId: null,
        position: { x: 0, y: 900 },
        size: { width: 400, height: 300 },
        tags: [],
        serviceId: null,
        cloudServiceId: null,
        technology: null,
      }),
    );
    move("free-panel");
    const before = s.text();
    await s.pump();
    expect(s.text()).toBe(before);
  });
});

describe("changing an element's catalog service or technology", () => {
  const change = (name: string, patch: Partial<PluginComponentSnapshot>) =>
    s.canvas.step(() =>
      Object.assign(
        s.canvas.components.find((c) => c.label === name)!,
        patch,
      ),
    );

  it("a new service of the same Kind sets spec.provider, keeping the element", async () => {
    const id = s.id("order-tracker");
    change("order-tracker", { cloudServiceId: "ecs", technology: "Lambda" });
    const plan = await s.pump();
    expect(s.text()).toMatch(/name: order-tracker\nspec:\n {2}provider: ECS\n/);
    expect(plan.changes.remove).toEqual([]);
    const tracker = s.canvas.components.find((c) => c.id === id)!;
    expect([tracker.cloudServiceId, tracker.technology]).toEqual(["ecs", "ECS"]);
    await s.expectSettled();
  });

  it("a technology naming another provider of the same service sets it", async () => {
    change("catalog-db", { technology: "AuroraMySQL" });
    await s.pump();
    expect(s.text()).toMatch(/name: catalog-db\nspec:\n {2}provider: AuroraMySQL\n/);
    await s.expectSettled();
  });

  it("what the manifest cannot say is reverted on the canvas", async () => {
    const before = s.text();
    change("order-tracker", { cloudServiceId: "dynamodb" }); // a Database service on an Application
    const r = reconcile(s.canvas.snapshot(), s.binding, s.files);
    expect(r.refusedProviders).toEqual(["order-tracker"]);
    await s.pump();
    expect(s.text()).toBe(before);
    expect(s.canvas.components.find((c) => c.label === "order-tracker")?.cloudServiceId).toBe(
      "lambda",
    );
    await s.expectSettled();
  });
});

describe("requireValid", () => {
  it("leaves the diagram as it was while the YAML has opscr errors, then draws it", async () => {
    const events: string[] = [];
    const engine = new OpscrEngine({
      ...s.engineOptions(),
      requireValid: true,
      onEvent: (event) => void events.push(event.type),
    });
    const count = s.canvas.components.length;
    const bad =
      "\n---\napiVersion: opscr.dev/v1\nkind: Cache\nmetadata:\n  name: price-cache\nspec:\n  provider: ElastiCache Redis\n  description: Prices\n  inventedField: 1\n";
    s.files = s.files.map((f) =>
      f.name === "commerce.opscr.yaml" ? { ...f, text: f.text + bad } : f,
    );
    await engine.sync();
    expect(events).toContain("invalid");
    expect(s.canvas.components).toHaveLength(count);
    s.files = s.files.map((f) =>
      f.name === "commerce.opscr.yaml"
        ? { ...f, text: f.text.replace("  inventedField: 1\n", "") }
        : f,
    );
    await engine.sync();
    expect(s.canvas.components).toHaveLength(count + 1);
  });
});

describe("another diagram opened while projecting", () => {
  it("draws nothing and keeps the binding: the changes would land on the other diagram", async () => {
    let open = true;
    const options = s.engineOptions();
    const engine = new OpscrEngine({
      ...options,
      diagram: { ...options.diagram, get: () => (open ? s.canvas.snapshot() : null) },
      project: async (...args) => {
        const result = await options.project(...args);
        open = false;
        return result;
      },
    });
    const count = s.canvas.components.length;
    const binding = structuredClone(s.binding);
    const cache =
      "\n---\napiVersion: opscr.dev/v1\nkind: Cache\nmetadata:\n  name: price-cache\nspec:\n  provider: ElastiCache Redis\n  description: Prices\n";
    s.files = s.files.map((f) =>
      f.name === "commerce.opscr.yaml" ? { ...f, text: f.text + cache } : f,
    );
    s.applied = [];
    await engine.sync();
    expect(s.applied).toEqual([]);
    expect(s.canvas.components).toHaveLength(count);
    expect(s.binding).toEqual(binding);
  });
});

describe("the canvas edited while projecting", () => {
  it("a delete made meanwhile is written, not drawn back", async () => {
    const options = s.engineOptions();
    const engine = new OpscrEngine({
      ...options,
      project: async (...args) => {
        const result = await options.project(...args);
        if (s.canvas.components.some((c) => c.label === "cart-cache")) {
          s.canvas.step(() => s.canvas.remove([s.id("cart-cache")]));
        }
        return result;
      },
    });
    const cache =
      "\n---\napiVersion: opscr.dev/v1\nkind: Cache\nmetadata:\n  name: price-cache\nspec:\n  provider: ElastiCache Redis\n  description: Prices\n";
    s.files = s.files.map((f) =>
      f.name === "commerce.opscr.yaml" ? { ...f, text: f.text + cache } : f,
    );
    await engine.sync();
    const labels = s.canvas.components.map((c) => c.label);
    expect(labels).toContain("price-cache");
    expect(labels).not.toContain("cart-cache");
    expect(s.text()).not.toMatch(/name: cart-cache/);
    await s.expectSettled();
  });
});

describe("a failing step", () => {
  it("is reported, and the next sync draws again", async () => {
    const events: string[] = [];
    let fail = true;
    const options = s.engineOptions();
    const engine = new OpscrEngine({
      ...options,
      diagram: {
        ...options.diagram,
        apply: (changes) => {
          if (fail) throw new Error("the host refused the changes");
          return options.diagram.apply(changes);
        },
      },
      onEvent: (event) => events.push(event.type),
    });
    const cache =
      "\n---\napiVersion: opscr.dev/v1\nkind: Cache\nmetadata:\n  name: price-cache\nspec:\n  provider: ElastiCache Redis\n  description: Prices\n";
    s.files = s.files.map((f) =>
      f.name === "commerce.opscr.yaml" ? { ...f, text: f.text + cache } : f,
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await engine.sync();
    error.mockRestore();
    expect(events).toContain("failed");
    expect(events).not.toContain("synced");

    fail = false;
    events.length = 0;
    await engine.sync();
    expect(events).toContain("synced");
    expect(s.canvas.components.map((c) => c.label)).toContain("price-cache");
  });
});
