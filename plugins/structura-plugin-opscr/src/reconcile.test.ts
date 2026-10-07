import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { countEdges, hasManifest, type SourceText } from "./patches";
import { projectWorkspace } from "./project";
import { reconcile, retire } from "./reconcile";
import { canvasLayout, emptyBinding, planSync, type BindingState } from "./sync";
import type {
  DiagramSnapshot,
  PluginComponentSnapshot,
  PluginConnectionSnapshot,
  PluginDiagramChanges,
  PluginDiagramChangesResult,
} from "./types/plugin.types";

const sampleDir = join(
  dirname(createRequire(import.meta.url).resolve("opscr/package.json")),
  "examples/sample",
);
const SAMPLE: SourceText[] = readdirSync(sampleDir)
  .filter((f) => f.endsWith(".opscr.yaml"))
  .sort()
  .map((name) => ({ name, text: readFileSync(join(sampleDir, name), "utf8") }));
const CONFIG = {
  path: "opscr.config.yaml",
  content: readFileSync(join(sampleDir, "opscr.config.yaml"), "utf8"),
};

/** A canvas that applies plugin changes the way the host does, close enough for diffs. */
class FakeCanvas {
  components: PluginComponentSnapshot[] = [];
  connections: PluginConnectionSnapshot[] = [];
  private next = 0;
  private history: Array<[PluginComponentSnapshot[], PluginConnectionSnapshot[]]> = [];
  private future: Array<[PluginComponentSnapshot[], PluginConnectionSnapshot[]]> = [];

  snapshot(): DiagramSnapshot {
    return {
      id: "d",
      name: "d",
      description: null,
      components: structuredClone(this.components),
      connections: structuredClone(this.connections),
    };
  }

  /** One history step, like every store action. */
  step(change: () => void) {
    this.history.push(structuredClone([this.components, this.connections]));
    this.future = [];
    change();
  }

  undo() {
    this.future.push(structuredClone([this.components, this.connections]));
    [this.components, this.connections] = this.history.pop()!;
  }

  redo() {
    this.history.push(structuredClone([this.components, this.connections]));
    [this.components, this.connections] = this.future.pop()!;
  }

  remove(ids: string[]) {
    const gone = new Set(ids);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of this.components) {
        if (c.parentId && gone.has(c.parentId) && !gone.has(c.id)) {
          gone.add(c.id);
          grew = true;
        }
      }
    }
    this.components = this.components.filter((c) => !gone.has(c.id));
    this.connections = this.connections.filter(
      (c) => !gone.has(c.sourceId) && !gone.has(c.targetId),
    );
  }

  connect(sourceId: string, targetId: string, label: string): string {
    const id = `e${this.next++}`;
    this.connections.push({ id, sourceId, targetId, label, description: null, technology: null });
    return id;
  }

  apply(changes: PluginDiagramChanges): PluginDiagramChangesResult {
    const result: PluginDiagramChangesResult = { idsByKey: {}, connectionIds: [] };
    if (Object.values(changes).every((l) => !l?.length)) return result;
    this.step(() => {
      this.remove(changes.remove ?? []);
      const cut = new Set(changes.disconnect ?? []);
      this.connections = this.connections.filter((c) => !cut.has(c.id));
      for (const u of changes.update ?? []) {
        const c = this.components.find((x) => x.id === u.id);
        if (!c) continue;
        if (u.name !== undefined) c.label = u.name;
        if (u.description !== undefined) c.description = u.description;
      }
      for (const m of changes.move ?? []) {
        const c = this.components.find((x) => x.id === m.id);
        if (!c) continue;
        c.position = { x: m.x, y: m.y };
        if (m.width !== undefined && m.height !== undefined)
          c.size = { width: m.width, height: m.height };
      }
      for (const a of changes.add ?? []) {
        const id = `c${this.next++}`;
        result.idsByKey[a.key] = id;
        const parent =
          a.parentKey === undefined ? null : (result.idsByKey[a.parentKey] ?? a.parentKey);
        this.components.push({
          id,
          type: a.type ?? "unknown",
          label: a.name,
          description: a.description ?? "",
          parentId: parent,
          position: { x: a.x ?? 0, y: a.y ?? 0 },
          size:
            a.width !== undefined && a.height !== undefined
              ? { width: a.width, height: a.height }
              : null,
          tags: [],
          serviceId: null,
        });
      }
      for (const c of changes.connect ?? []) {
        const source = result.idsByKey[c.source] ?? c.source;
        const target = result.idsByKey[c.target] ?? c.target;
        const id = `e${this.next++}`;
        this.connections.push({
          id,
          sourceId: source,
          targetId: target,
          label: c.label ?? "",
          description: null,
          technology: null,
        });
        result.connectionIds.push(id);
      }
    });
    return result;
  }
}

/** The pane's loop without React: reconcile, then sync, with tombstones for sync removals. */
class Session {
  canvas = new FakeCanvas();
  binding: BindingState = emptyBinding();
  files: SourceText[] = structuredClone(SAMPLE);
  synced: SourceText[] = [];
  refused: string[] = [];

  async pump() {
    const r = reconcile(this.canvas.snapshot(), this.binding, this.files);
    this.files = r.files;
    this.binding = r.binding;
    this.refused = r.refused;
    this.canvas.apply(r.revert);
    return this.sync();
  }

  async sync() {
    const diagram = this.canvas.snapshot();
    const projection = await projectWorkspace(
      this.files.map((f) => ({ path: f.name, content: f.text })),
      CONFIG,
      canvasLayout(this.binding, diagram),
    );
    const plan = planSync(projection.graph!, this.binding, diagram);
    const result = this.canvas.apply(plan.changes);
    this.binding = retire(this.binding, plan.commit(result), this.synced);
    this.synced = structuredClone(this.files);
    return plan;
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
      }),
    );
    const r = reconcile(s.canvas.snapshot(), s.binding, s.files);
    expect(r.changed).toBe(false);
    expect(r.notInYaml).toBe(1);
  });

  it("skips while a file does not parse", () => {
    const broken = s.files.map((f, i) => (i === 0 ? { ...f, text: `${f.text}\n  bad: [\n` } : f));
    s.canvas.step(() => s.canvas.remove([s.id("cart-cache")]));
    const r = reconcile(s.canvas.snapshot(), s.binding, broken);
    expect(r.skipped).toBe(true);
    expect(r.files).toEqual(broken);
  });
});
